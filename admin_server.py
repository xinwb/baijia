#!/usr/bin/env python3
"""Small dependency-free YADILO back office.

Run with: python3 admin_server.py --host 127.0.0.1 --port 8787
The same process serves /admin.html, /api/* and the existing static site.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sqlite3
import time
import imghdr
import re
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("YADILO_DB", ROOT / "database" / "yadilo.sqlite"))
SCHEMA_PATH = ROOT / "database" / "schema.sql"
SESSION_TTL = 8 * 60 * 60
COOKIE_NAME = "yadilo_admin"
CSRF_HEADER = "X-YADILO-CSRF"
SESSIONS: dict[str, dict[str, object]] = {}
LOGIN_FAILURES: dict[str, list[float]] = {}
LOGIN_WINDOW = 15 * 60
LOGIN_LIMIT = 8
AI_REQUESTS: dict[str, list[float]] = {}
AI_RATE_WINDOW = 15 * 60
AI_RATE_LIMIT = 6
AI_REQUEST_TIMEOUT = 60
UPLOAD_ROOT = ROOT / "assets" / "uploads"
ALLOWED_UPLOADS = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}
ROLE_LEVELS = {"viewer": 10, "editor": 20, "dealer_manager": 30, "admin": 40, "super_admin": 50}
SETTING_RULES = {
    "security.session_ttl": ("number", 900, 86400),
    "security.login_limit": ("number", 3, 20),
    "security.login_window": ("number", 60, 86400),
    "security.require_csrf": ("boolean", None, None),
    "uploads.max_bytes": ("number", 1024, 12_000_000),
    "uploads.allowed_types": ("json", None, None),
}
DEFAULT_SETTINGS = (
    ("security.session_ttl", "28800", "number", "后台登录会话有效期（秒）"),
    ("security.login_limit", "8", "number", "同一账号在限流窗口内允许的失败次数"),
    ("security.login_window", "900", "number", "登录失败限流窗口（秒）"),
    ("security.require_csrf", "1", "boolean", "后台写操作是否要求 CSRF 校验"),
    ("uploads.max_bytes", "12000000", "number", "单张图片最大字节数"),
    ("uploads.allowed_types", json.dumps(sorted(ALLOWED_UPLOADS)), "json", "允许上传的图片扩展名"),
)


def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def bootstrap():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = db()
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    existing_columns = {item[1] for item in connection.execute("PRAGMA table_info(dimension_rules)").fetchall()}
    for name, sql_type in {
        "panel_thickness_mm": "REAL",
        "door_depth_mm": "REAL",
        "frame_depth_mm": "REAL",
        "casing_depth_mm": "REAL",
        "lock_gap_mm": "REAL",
        "lock_height_mm": "REAL",
    }.items():
        if name not in existing_columns:
            connection.execute(f"ALTER TABLE dimension_rules ADD COLUMN {name} {sql_type}")
    admin_columns = {item[1] for item in connection.execute("PRAGMA table_info(admin_users)").fetchall()}
    if "dealer_id" not in admin_columns:
        connection.execute("ALTER TABLE admin_users ADD COLUMN dealer_id INTEGER")
    admin_user = os.environ.get("YADILO_ADMIN_USER", "admin")
    admin_password = os.environ.get("YADILO_ADMIN_PASSWORD")
    if not connection.execute("SELECT 1 FROM admin_users LIMIT 1").fetchone():
        if not admin_password:
            connection.close()
            raise RuntimeError("首次启动必须设置 YADILO_ADMIN_PASSWORD，拒绝使用默认管理员密码")
        connection.execute(
            "INSERT INTO admin_users(username,password_hash,display_name,role) VALUES (?,?,?,?)",
            (admin_user, hash_password(admin_password), "雅帝乐管理员", "super_admin"),
        )
    else:
        connection.execute("UPDATE admin_users SET role='super_admin' WHERE username=? AND role='admin'", (admin_user,))
    connection.executemany(
        "INSERT OR IGNORE INTO system_settings(setting_key,setting_value,value_type,description,is_public) VALUES(?,?,?,?,0)",
        DEFAULT_SETTINGS,
    )
    apply_catalog_consistency(connection)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    connection.commit()
    connection.close()


def hash_password(value: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", value.encode(), salt, 180_000)
    return "pbkdf2_sha256$180000$%s$%s" % (
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(digest).decode(),
    )


def verify_password(value: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt_text, digest_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        actual = hashlib.pbkdf2_hmac("sha256", value.encode(), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def json_value(value, default):
    if value is None:
        return default
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def rows(connection, sql, params=()):
    return [dict(row) for row in connection.execute(sql, params).fetchall()]


def row(connection, sql, params=()):
    item = connection.execute(sql, params).fetchone()
    return dict(item) if item else None


def as_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def as_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def as_bool(value):
    return 1 if value in (True, 1, "1", "true", "on", "yes") else 0


def role_at_least(role, minimum):
    return ROLE_LEVELS.get(role or "", 0) >= ROLE_LEVELS[minimum]


def safe_name(value):
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "")).strip(".-")
    return name[:80] or "asset"


def validate_username(value):
    username = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{2,63}", username):
        raise ValueError("账号需为 3-64 位字母、数字、点、下划线或连字符")
    return username


def validate_setting(key, value_type, value):
    rule = SETTING_RULES.get(key)
    if not rule:
        raise ValueError("不允许修改此系统配置")
    expected_type, minimum, maximum = rule
    if value_type != expected_type:
        raise ValueError("系统配置类型不匹配")
    if value_type == "number":
        number = as_int(value)
        if number is None or not minimum <= number <= maximum:
            raise ValueError(f"配置值必须在 {minimum} 到 {maximum} 之间")
        return str(number)
    if value_type == "boolean":
        return "1" if as_bool(value) else "0"
    try:
        parsed = value if not isinstance(value, str) else json.loads(value)
    except json.JSONDecodeError as error:
        raise ValueError("JSON 配置格式无效") from error
    if key == "uploads.allowed_types":
        if not isinstance(parsed, list) or not parsed or any(str(item).lower() not in ALLOWED_UPLOADS for item in parsed):
            raise ValueError("允许格式只能是 JPG、JPEG、PNG、WEBP、GIF")
        parsed = sorted(set(str(item).lower() for item in parsed))
    return json.dumps(parsed, ensure_ascii=False)


def json_text(value, default):
    return json.dumps(value if value is not None else default, ensure_ascii=False)


def setting_value(key, default=None):
    try:
        connection = db()
        item = connection.execute("SELECT setting_value,value_type FROM system_settings WHERE setting_key=?", (key,)).fetchone()
        connection.close()
        if not item:
            return default
        if item["value_type"] == "number":
            return as_int(item["setting_value"], default)
        if item["value_type"] == "boolean":
            return item["setting_value"] == "1"
        if item["value_type"] == "json":
            return json.loads(item["setting_value"])
        return item["setting_value"]
    except (sqlite3.Error, json.JSONDecodeError, TypeError):
        return default


def validate_dimension(item):
    required = ("width_min_mm", "width_default_mm", "width_max_mm", "height_min_mm", "height_default_mm", "height_max_mm")
    values = {key: as_int(item.get(key)) for key in required}
    if any(value is None or value <= 0 for value in values.values()):
        raise ValueError("尺寸必须是正整数")
    if not (values["width_min_mm"] <= values["width_default_mm"] <= values["width_max_mm"]):
        raise ValueError("宽度范围顺序不正确")
    if not (values["height_min_mm"] <= values["height_default_mm"] <= values["height_max_mm"]):
        raise ValueError("高度范围顺序不正确")
    return values


def validate_product_id(connection, product_id):
    if not product_id or not row(connection, "SELECT id FROM products WHERE id=?", (product_id,)):
        raise ValueError("产品不存在")
    return product_id


def validate_product_configuration(connection, product_id, selected_types):
    validate_product_id(connection, product_id)
    if not selected_types:
        raise ValueError("至少选择一个支持门型")
    type_ids = [as_int(item.get("door_type_id")) for item in selected_types]
    if any(not type_id for type_id in type_ids) or len(set(type_ids)) != len(type_ids):
        raise ValueError("门型不能为空且不能重复")
    known = {item["id"] for item in rows(connection, "SELECT id FROM door_types WHERE active=1")}
    if not set(type_ids).issubset(known):
        raise ValueError("包含无效或已停用的门型")
    if sum(as_bool(item.get("is_default")) for item in selected_types) != 1:
        raise ValueError("必须且只能设置一个默认门型")
    for item in selected_types:
        validate_dimension(item)
    return set(type_ids)


def catalog_audit(connection):
    summary = {
        "active_products": connection.execute("SELECT COUNT(*) FROM products WHERE active=1").fetchone()[0],
        "active_configurable": connection.execute("SELECT COUNT(*) FROM products WHERE active=1 AND configurator_key IS NOT NULL").fetchone()[0],
        "duplicate_configurator_keys": connection.execute("SELECT COUNT(*) FROM (SELECT configurator_key FROM products WHERE active=1 AND configurator_key IS NOT NULL GROUP BY configurator_key HAVING COUNT(*) > 1)").fetchone()[0],
        "active_config_missing_types": connection.execute("SELECT COUNT(*) FROM products p WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_door_types x WHERE x.product_id=p.id)").fetchone()[0],
        "active_config_missing_dimensions": connection.execute("SELECT COUNT(*) FROM products p WHERE p.active=1 AND p.configurator_key IS NOT NULL AND EXISTS (SELECT 1 FROM product_door_types pt WHERE pt.product_id=p.id AND NOT EXISTS (SELECT 1 FROM dimension_rules dr WHERE dr.product_id=pt.product_id AND dr.door_type_id=pt.door_type_id))").fetchone()[0],
        "active_config_missing_prices": connection.execute("SELECT COUNT(*) FROM products p WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM price_rules pr WHERE pr.product_id=p.id OR (pr.product_id IS NULL AND pr.series_id=p.series_id))").fetchone()[0],
        "active_config_missing_option_prices": connection.execute("SELECT COUNT(*) FROM product_options po JOIN products p ON p.id=po.product_id WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM price_rules pr WHERE pr.product_id=po.product_id AND pr.option_id=po.option_id AND pr.price_kind='option')").fetchone()[0],
        "active_config_missing_assets": connection.execute("SELECT COUNT(*) FROM products p WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM asset_references ar WHERE ar.product_id=p.id AND lower(ar.file_path) NOT LIKE '%pdf-previews%')").fetchone()[0],
        "inactive_price_rules": connection.execute("SELECT COUNT(*) FROM price_rules pr JOIN products p ON p.id=pr.product_id WHERE p.active=0").fetchone()[0],
        "price_unlinked_options": connection.execute("SELECT COUNT(*) FROM price_rules pr JOIN products p ON p.id=pr.product_id WHERE pr.option_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_options po WHERE po.product_id=p.id AND po.option_id=pr.option_id)").fetchone()[0],
        "price_unlinked_types": connection.execute("SELECT COUNT(*) FROM price_rules pr JOIN products p ON p.id=pr.product_id WHERE pr.door_type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_door_types pt WHERE pt.product_id=p.id AND pt.door_type_id=pr.door_type_id)").fetchone()[0],
        "options_missing_type_links": connection.execute("SELECT COUNT(*) FROM product_options po JOIN products p ON p.id=po.product_id WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_door_type_options pto WHERE pto.product_id=po.product_id AND pto.option_id=po.option_id AND pto.compatible=1)").fetchone()[0],
        "inactive_product_options": connection.execute("SELECT COUNT(*) FROM product_options po JOIN products p ON p.id=po.product_id JOIN options o ON o.id=po.option_id WHERE p.active=1 AND p.configurator_key IS NOT NULL AND o.active=0").fetchone()[0],
        "invalid_dimensions": connection.execute("SELECT COUNT(*) FROM dimension_rules WHERE width_min_mm<=0 OR width_default_mm<width_min_mm OR width_default_mm>width_max_mm OR height_min_mm<=0 OR height_default_mm<height_min_mm OR height_default_mm>height_max_mm").fetchone()[0],
    }
    issues = []
    issue_queries = (
        ("missing_types", "SELECT id,name,configurator_key FROM products WHERE active=1 AND configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_door_types x WHERE x.product_id=products.id)"),
        ("missing_dimensions", "SELECT DISTINCT p.id,p.name,p.configurator_key FROM products p JOIN product_door_types pt ON pt.product_id=p.id WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dimension_rules dr WHERE dr.product_id=pt.product_id AND dr.door_type_id=pt.door_type_id)"),
        ("missing_prices", "SELECT id,name,configurator_key FROM products p WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM price_rules pr WHERE pr.product_id=p.id OR (pr.product_id IS NULL AND pr.series_id=p.series_id))"),
        ("missing_option_prices", "SELECT p.id,p.name,p.configurator_key,po.option_id FROM product_options po JOIN products p ON p.id=po.product_id WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM price_rules pr WHERE pr.product_id=po.product_id AND pr.option_id=po.option_id AND pr.price_kind='option')"),
        ("missing_assets", "SELECT p.id,p.name,p.configurator_key FROM products p WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM asset_references ar WHERE ar.product_id=p.id AND lower(ar.file_path) NOT LIKE '%pdf-previews%')"),
        ("price_unlinked_options", "SELECT pr.id,p.name,pr.option_id FROM price_rules pr JOIN products p ON p.id=pr.product_id WHERE pr.option_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_options po WHERE po.product_id=p.id AND po.option_id=pr.option_id)"),
        ("price_unlinked_types", "SELECT pr.id,p.name,pr.door_type_id FROM price_rules pr JOIN products p ON p.id=pr.product_id WHERE pr.door_type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_door_types pt WHERE pt.product_id=p.id AND pt.door_type_id=pr.door_type_id)"),
        ("option_type_links", "SELECT p.id,p.name,p.configurator_key,po.option_id FROM product_options po JOIN products p ON p.id=po.product_id WHERE p.active=1 AND p.configurator_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_door_type_options pto WHERE pto.product_id=po.product_id AND pto.option_id=po.option_id AND pto.compatible=1)"),
    )
    for issue_type, query in issue_queries:
        for item in rows(connection, query):
            issues.append({"type": issue_type, **item})
    return {"summary": summary, "issues": issues}


def apply_catalog_consistency(connection):
    """Repair only deterministic catalog links and official source values."""
    source_id = connection.execute("SELECT id FROM source_documents WHERE source_key LIKE '%官方指导价%' LIMIT 1").fetchone()[0]
    # The front-end `jinqu` model is the catalogue's 金曲 row, not 缦玉.
    wrong = connection.execute("SELECT id FROM products WHERE configurator_key='jinqu' AND name LIKE '%缦玉%'").fetchone()
    right = connection.execute("SELECT id FROM products WHERE name='金曲岩板' LIMIT 1").fetchone()
    if wrong and right:
        connection.execute("UPDATE products SET configurator_key=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?", (wrong[0],))
        connection.execute("UPDATE products SET configurator_key='jinqu',updated_at=CURRENT_TIMESTAMP WHERE id=?", (right[0],))
        for table, columns in (
            ("product_door_types", "door_type_id,is_default,source_document_id"),
            ("product_options", "option_id,is_default,is_required,price_override_cents,compatibility_note,source_document_id"),
            ("product_door_type_options", "door_type_id,option_id,compatible,note"),
            ("product_attributes", "attribute_key,attribute_value,value_type,source_document_id"),
        ):
            connection.execute(f"INSERT OR IGNORE INTO {table} (product_id,{columns}) SELECT ?,{columns} FROM {table} WHERE product_id=?", (right[0], wrong[0]))
            connection.execute(f"DELETE FROM {table} WHERE product_id=?", (wrong[0],))
        connection.execute("UPDATE dimension_rules SET product_id=? WHERE product_id=?", (right[0], wrong[0]))
        connection.execute("UPDATE asset_references SET product_id=? WHERE product_id=?", (right[0], wrong[0]))
    # Add the D90 dimension rule that the configurator actually exposes.
    d90_dims = {"sideLight": (4, 1600, 1900, 2300, 2300, 2600, 3100), "double": (3, 1700, 1800, 2200, 3000, 3500, 4000)}
    for product in connection.execute("SELECT id,configurator_key FROM products WHERE active=1 AND configurator_key IS NOT NULL AND configurator_key NOT IN ('ruojian','yuanyin','jiangchuan','jinghong','qinghuafu')").fetchall():
        type_row = connection.execute("SELECT door_type_id FROM product_door_types WHERE product_id=? LIMIT 1", (product[0],)).fetchone()
        if not type_row: continue
        dims = d90_dims.get('sideLight' if product[1] == 'jinqu' else 'double')
        if not dims: continue
        connection.execute("DELETE FROM dimension_rules WHERE product_id=? AND door_type_id=?", (product[0], type_row[0]))
        connection.execute("INSERT INTO dimension_rules(product_id,door_type_id,width_min_mm,width_default_mm,width_max_mm,height_min_mm,height_default_mm,height_max_mm,notes,source_document_id) VALUES(?,?,?,?,?,?,?,?,?,?)", (product[0], dims[0], *dims[1:], '来自 D90 配置器实际门型范围；官方报价手册第95-97页', source_id))

    # Rebuild configurable-product option links from the actual selector keys
    # in d90-configurator.js and glb-configurator.js. This removes stale
    # generic options such as the old P40 casing from products that do not
    # expose a casing selector, while preserving every product master and
    # customer-facing business record.
    group_ids = {item[0]: item[1] for item in connection.execute("SELECT code,id FROM option_groups").fetchall()}

    def ensure_group(code, name, sort_order):
        if code not in group_ids:
            connection.execute("INSERT INTO option_groups(code,name,selection_mode,required,sort_order) VALUES(?,?,?,?,?)", (code, name, 'single', 0, sort_order))
            group_ids[code] = connection.execute("SELECT id FROM option_groups WHERE code=?", (code,)).fetchone()[0]
        return group_ids[code]

    def ensure_option(group, key, name, note=''):
        group_id = ensure_group(group, group, 95)
        connection.execute("""
            INSERT INTO options(option_group_id,option_key,name,note,price_cents,unit,active)
            VALUES(?,?,?,?,0,'each',1)
            ON CONFLICT(option_group_id,option_key) DO UPDATE SET name=excluded.name,note=excluded.note,active=1
        """, (group_id, key, name, note))
        return connection.execute("SELECT id FROM options WHERE option_group_id=? AND option_key=?", (group_id, key)).fetchone()[0]

    labels = {
        'color': {
            'bmw-gray': '宝马灰', 'deep-bronze': '深古铜', 'graphite': '石墨灰', 'brass-11': '花絮黄铜 11#',
            'blue-8': '泰蓝织彩 8#', 'warm-brass': '暖黄铜', 'black': '雅黑', 'gloss-black': '炫光黑',
            'green-bronze': '青古铜', 'titanium': '钛灰', 'brass-13': '花繁黄铜 13#', 'antique-gold': '旧金',
            'yingmu': '影木 1#', 'oak': '美洲橡木 1#', 'bronze': '花絮深古铜 1#', 'silver': '银灰',
            'champagne': '香槟铜', 'ink-gold': '墨金', 'original': '原始工艺色', 'ink-green': '墨绿雨花点', 'deep-green': '深墨绿'
        },
        'texture_variant': {'factory': '原厂纹理', 'relief': '浮雕强化', 'matte': '哑光拉丝'},
        'texture_surface': {'factory': '原厂实拍', 'graphite': '深钛灰肌理', 'bronze': '暖古铜肌理', 'titanium': '雾银钛肌理'},
        'transom': {'none': '无气窗', 'door-extended': '门体加高气窗', 'square-true': '方形真气窗', 'integrated': '方形门窗一体'},
        'opening': {'out-left': '外开左锁', 'out-right': '外开右锁', 'in-left': '内开左锁', 'in-right': '内开右锁'},
        'frame_install': {'outside': '靠墙外', 'center': '靠中装', 'inside': '靠墙内'},
        'frame_build': {'integral': '整体制作', 'assembled': '拼装制作'},
        'hinge': {'d90-hidden': 'D90 标配暗合页', 'd90-heavy': 'D90 重载外合页', 'k80-hidden': 'K80 单轴暗合页', 'k80-five-axis': 'K80 全钢五轴', 'k80-external': 'K80 重载外合页'},
        'lock': {'none': '隐藏锁体（无外露）', 'smart': '智能锁', 'yt82': 'YT82 圆形锁'},
        'handle': {'none': '无外拉手', 'long': 'SL48F 通天拉手', 'ring': '环形拉手', 'integrated': '纹理一体灯带拉手'}
    }
    group_sort = {'texture_surface': 21, 'frame_install': 51}
    for group in labels:
        ensure_group(group, group, group_sort.get(group, 95))
    for group, values in labels.items():
        for key, name in values.items():
            ensure_option(group, key, name, '来自前台配置器实际选项')

    d90_types = {
        'jinqu': [('color', ['bmw-gray', 'deep-bronze', 'graphite']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('hinge', ['d90-hidden', 'd90-heavy']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none'])],
        'shirui': [('color', ['brass-11', 'blue-8', 'warm-brass']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('hinge', ['d90-hidden', 'd90-heavy']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none'])],
        'shicui': [('color', ['black', 'graphite', 'deep-bronze']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('hinge', ['d90-hidden', 'd90-heavy']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none', 'integrated'])],
        'aige': [('color', ['gloss-black', 'green-bronze', 'titanium']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('hinge', ['d90-hidden', 'd90-heavy']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none', 'long', 'ring'])],
        'songge': [('color', ['gloss-black', 'graphite', 'deep-bronze']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('hinge', ['d90-hidden', 'd90-heavy']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart', 'yt82']), ('handle', ['none', 'ring'])],
        'guanmin': [('color', ['brass-13', 'deep-bronze', 'antique-gold']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('hinge', ['d90-hidden', 'd90-heavy']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart', 'yt82']), ('handle', ['none', 'long'])]
    }
    k80_types = {
        'ruojian': [('color', ['yingmu', 'oak', 'graphite']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('transom', ['none', 'door-extended', 'square-true', 'integrated']), ('hinge', ['k80-hidden', 'k80-five-axis', 'k80-external']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none'])],
        'yuanyin': [('color', ['bronze', 'silver', 'champagne']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('transom', ['none', 'door-extended', 'square-true', 'integrated']), ('hinge', ['k80-hidden', 'k80-five-axis', 'k80-external']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none'])],
        'jiangchuan': [('color', ['green-bronze', 'graphite', 'deep-bronze']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('transom', ['none', 'door-extended', 'square-true', 'integrated']), ('hinge', ['k80-hidden', 'k80-five-axis', 'k80-external']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none', 'ring'])],
        'jinghong': [('color', ['green-bronze', 'silver', 'ink-gold']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('transom', ['none', 'door-extended', 'square-true', 'integrated']), ('hinge', ['k80-hidden', 'k80-five-axis', 'k80-external']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none'])],
        'qinghuafu': [('color', ['ink-green', 'green-bronze', 'deep-green']), ('texture_variant', ['factory', 'relief', 'matte']), ('texture_surface', ['factory', 'graphite', 'bronze', 'titanium']), ('transom', ['none', 'door-extended', 'square-true', 'integrated']), ('hinge', ['k80-hidden', 'k80-five-axis', 'k80-external']), ('opening', ['out-left', 'out-right', 'in-left', 'in-right']), ('frame_install', ['outside', 'center', 'inside']), ('frame_build', ['integral', 'assembled']), ('lock', ['none', 'smart']), ('handle', ['none', 'ring'])]
    }
    defaults = {
        'ruojian': ('out-left', 'smart', 'none'), 'yuanyin': ('out-right', 'none', 'none'), 'jiangchuan': ('out-right', 'none', 'ring'), 'jinghong': ('out-right', 'none', 'none'), 'qinghuafu': ('out-right', 'none', 'ring'),
        'jinqu': ('out-right', 'smart', 'none'), 'shirui': ('out-right', 'smart', 'none'), 'shicui': ('out-right', 'smart', 'none'), 'aige': ('out-right', 'none', 'long'), 'songge': ('out-right', 'smart', 'ring'), 'guanmin': ('out-right', 'none', 'long')
    }
    # Only map a hardware amount where the PDF label and the configurator
    # option are the same physical item. Other selectable hardware remains
    # explicitly inquiry-priced instead of inheriting a generic amount.
    official_handles = {('aige', 'long'): 540000, ('songge', 'ring'): 168000, ('guanmin', 'long'): 600000}
    configurable = connection.execute("SELECT p.id,p.configurator_key,s.code FROM products p JOIN product_series s ON s.id=p.series_id WHERE p.active=1 AND p.configurator_key IS NOT NULL").fetchall()
    for product_id, key, series in configurable:
        type_ids = [item[0] for item in connection.execute("SELECT door_type_id FROM product_door_types WHERE product_id=?", (product_id,)).fetchall()]
        specs = (d90_types if series == 'd90' else k80_types).get(key, [])
        if not specs:
            continue
        selected = []
        for group, keys in specs:
            for option_key in keys:
                option_id = connection.execute("SELECT id FROM options WHERE option_group_id=? AND option_key=?", (group_ids[group], option_key)).fetchone()[0]
                default = ((group == 'color' and option_key == keys[0]) or (group == 'texture_variant' and option_key == 'factory') or (group == 'texture_surface' and option_key == 'factory') or (group == 'transom' and option_key == 'none') or (group == 'hinge' and option_key in {'d90-hidden', 'k80-hidden'}) or (group == 'opening' and option_key == defaults[key][0]) or (group == 'frame_install' and option_key == 'center') or (group == 'frame_build' and option_key == 'integral') or (group == 'lock' and option_key == defaults[key][1]) or (group == 'handle' and option_key == defaults[key][2]))
                amount = official_handles.get((key, option_key))
                if group in {'color', 'texture_variant', 'texture_surface', 'transom', 'opening', 'frame_install', 'frame_build', 'hinge'} or option_key == 'none':
                    amount = 0
                note = '前台实际可选；包含在产品结构/饰面价内' if amount == 0 else ('官方报价手册五金价' if amount is not None else '前台实际可选；价格待询价')
                selected.append((option_id, int(default), amount, note))
        connection.execute("DELETE FROM product_options WHERE product_id=?", (product_id,))
        connection.execute("DELETE FROM product_door_type_options WHERE product_id=?", (product_id,))
        connection.execute("DELETE FROM price_rules WHERE product_id=? AND option_id IS NOT NULL", (product_id,))
        for option_id, is_default, amount, note in selected:
            connection.execute("INSERT INTO product_options(product_id,option_id,is_default,is_required,price_override_cents,compatibility_note,source_document_id) VALUES(?,?,?,?,?,?,?)", (product_id, option_id, is_default, 0, amount, note, source_id))
            for type_id in type_ids:
                connection.execute("INSERT INTO product_door_type_options(product_id,door_type_id,option_id,compatible,note) VALUES(?,?,?,?,?)", (product_id, type_id, option_id, 1, note))
            connection.execute("INSERT INTO price_rules(product_id,option_id,price_kind,amount_cents,unit,notes,source_document_id,source_locator) VALUES(?,?,?,?,?,?,?,?)", (product_id, option_id, 'option', amount, 'each', note, source_id, '官方报价手册' if amount is not None and amount > 0 else '前台配置器'))

    # The first asset import matched directory names against Chinese product
    # names and consequently attached many real files to a generic catalog
    # row. Reconcile by the authoritative configurator asset directory. This
    # only changes catalog ownership; the files themselves are untouched.
    asset_keys = {
        'ruojian': 8, 'jiangchuan': 9, 'jinghong': 17, 'qinghuafu': 24, 'yuanyin': 45,
        'aige': 295, 'shicui': 296, 'guanmin': 297, 'jinqu': 299, 'shirui': 300, 'songge': 301,
    }
    for key, product_id in asset_keys.items():
        like_key = f'%/{key}/%'
        connection.execute("UPDATE asset_references SET product_id=? WHERE file_path LIKE ?", (product_id, like_key))
        connection.execute("UPDATE asset_references SET product_id=? WHERE product_id IS NULL AND file_path LIKE ?", (product_id, f'%{key}%'))
        connection.execute("""
            UPDATE asset_references
            SET asset_role=CASE
                WHEN lower(file_path) LIKE '%hardware%' THEN 'hardware'
                WHEN lower(file_path) LIKE '%casing%' THEN 'casing'
                WHEN lower(file_path) LIKE '%texture%' OR lower(file_path) LIKE '%door-skins%' THEN 'texture'
                WHEN lower(file_path) LIKE '%detail%' THEN 'detail'
                ELSE 'front'
            END,
            is_primary=CASE WHEN lower(file_path) LIKE '%/front-%' THEN 1 ELSE 0 END
            WHERE product_id=?
        """, (product_id,))
        front = connection.execute("SELECT file_path FROM asset_references WHERE product_id=? AND lower(file_path) LIKE '%/front-%' ORDER BY id LIMIT 1", (product_id,)).fetchone()
        if front:
            connection.execute("UPDATE products SET thumbnail_path=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (front[0], product_id))
    qinghua_id = asset_keys['qinghuafu']
    for file_path in (
        'assets/catalog/derived/k80/door-skins/k80-qinghuafu-double-leaf.png',
        'assets/catalog/derived/k80/door-skins/k80-qinghuafu-clean-hardware-v1.png',
        'assets/catalog/derived/k80/textures/k80-qing-hua-fu-base-ai-v1.png',
    ):
        if connection.execute("SELECT 1 FROM asset_references WHERE product_id=? AND file_path=?", (qinghua_id, file_path)).fetchone():
            continue
        connection.execute("INSERT INTO asset_references(product_id,asset_role,file_path,is_primary) VALUES(?,?,?,?)", (qinghua_id, 'texture', file_path, 1 if 'double-leaf' in file_path else 0))
    official = {
        '雅帝圆隐': (520000, 516000, '官方报价手册 K80 第45款'),
        '金曲岩板': (None, 600000, '官方报价指导手册 D90 第9款金曲'),
        '爱格铝板': (None, 1496000, '官方报价指导手册 D90 第5款爱格'),
        '拾翠薄铝': (None, 676000, '官方报价指导手册 D90 第6款拾翠'),
        '冠冕铸铜': (None, 3920000, '官方报价指导手册 D90 第7款冠冕'),
        '世瑞黄铜门联窗': (None, 1120000, '官方报价指导手册 D90 第10款世瑞'),
        '颂歌20mm精雕': (None, 1440000, '官方报价指导手册 D90 第11款颂歌'),
    }
    for name, (base, finish, note) in official.items():
        product = connection.execute("SELECT id FROM products WHERE name=? LIMIT 1", (name,)).fetchone()
        if not product: continue
        if base is not None and not connection.execute("SELECT 1 FROM price_rules WHERE product_id=? AND price_kind='base_area'", (product[0],)).fetchone():
            connection.execute("INSERT INTO price_rules(product_id,price_kind,amount_cents,unit,notes,source_document_id,source_locator) VALUES(?,?,?,?,?,?,?)", (product[0], 'base_area', base, 'sqm', note, source_id, '官方报价手册'))
        if finish is not None and not connection.execute("SELECT 1 FROM price_rules WHERE product_id=? AND price_kind='finish_area' AND amount_cents=?", (product[0], finish)).fetchone():
            connection.execute("INSERT INTO price_rules(product_id,price_kind,amount_cents,unit,notes,source_document_id,source_locator) VALUES(?,?,?,?,?,?,?)", (product[0], 'finish_area', finish, 'sqm', note, source_id, '官方报价手册'))
    connection.commit()


class Handler(BaseHTTPRequestHandler):
    server_version = "YADILOAdmin/1.0"

    def log_message(self, format, *args):
        return

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, body, content_type="text/plain; charset=utf-8", status=HTTPStatus.OK):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def parse_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 4_000_000:
            raise ValueError("request body too large")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8") or "{}")

    def allowed_cors_origin(self):
        origin = self.headers.get("Origin", "").rstrip("/")
        if not origin:
            return ""
        configured = {item.strip().rstrip("/") for item in os.environ.get("YADILO_CORS_ORIGINS", "").split(",") if item.strip()}
        host = self.headers.get("Host", "").lower()
        local_origins = {f"http://{host}", f"https://{host}"} if host else set()
        return origin if origin in configured or origin in local_origins else ""

    def ai_request_allowed(self):
        client = self.client_address[0]
        now = time.time()
        requests = [stamp for stamp in AI_REQUESTS.get(client, []) if now - stamp < AI_RATE_WINDOW]
        if len(requests) >= AI_RATE_LIMIT:
            self.send_json({"error": "AI 请求过于频繁，请稍后再试"}, HTTPStatus.TOO_MANY_REQUESTS)
            return False
        requests.append(now)
        AI_REQUESTS[client] = requests
        return True

    def proxy_ai_generation(self, payload):
        if not self.ai_request_allowed():
            return
        endpoint = os.environ.get("YADILO_AI_ENDPOINT", "").strip()
        api_key = os.environ.get("YADILO_AI_API_KEY", "").strip()
        if not endpoint or not api_key:
            self.send_json({"error": "AI 服务尚未由服务器启用"}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        prompt = str(payload.get("prompt", "")).strip()
        if not prompt or len(prompt) > 12_000:
            self.send_json({"error": "AI 提示词不能为空且不能超过 12000 字"}, HTTPStatus.BAD_REQUEST)
            return
        model = str(payload.get("model") or "gpt-image-2")[:80]
        size = str(payload.get("size") or "1536x1024")[:32]
        quality = str(payload.get("quality") or "high")[:32]
        reference_image = str(payload.get("referenceImage") or "")
        try:
            headers = {"Authorization": f"Bearer {api_key}"}
            if reference_image:
                match = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64),([A-Za-z0-9+/=]+)", reference_image)
                if not match:
                    raise ValueError("参考图格式无效")
                image = base64.b64decode(match.group(2), validate=True)
                if not image or len(image) > 2_500_000:
                    raise ValueError("参考图必须在 2.5MB 以内")
                edit_endpoint = os.environ.get("YADILO_AI_EDIT_ENDPOINT", "").strip() or endpoint.replace("/generations", "/edits")
                boundary = f"----YadiloProxy{secrets.token_hex(12)}"
                fields = {"model": model, "prompt": prompt, "size": size, "quality": quality, "n": "1", "input_fidelity": "high"}
                chunks = [f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode("utf-8") for key, value in fields.items()]
                mime = match.group(1)
                chunks.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"yadilo-door-reference.{mime.split('/')[-1]}\"\r\nContent-Type: {mime}\r\n\r\n".encode("utf-8"))
                chunks.extend((image, b"\r\n", f"--{boundary}--\r\n".encode("utf-8")))
                body = b"".join(chunks)
                headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
                request = urllib.request.Request(edit_endpoint, data=body, headers=headers, method="POST")
            else:
                body = json.dumps({"model": model, "prompt": prompt, "size": size, "quality": quality, "n": 1}, ensure_ascii=False).encode("utf-8")
                headers["Content-Type"] = "application/json"
                request = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(request, timeout=AI_REQUEST_TIMEOUT) as response:
                data = json.loads(response.read().decode("utf-8"))
            self.send_json(data)
        except ValueError as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except urllib.error.HTTPError:
            self.send_json({"error": "AI 服务返回异常，请稍后重试"}, HTTPStatus.BAD_GATEWAY)
        except (urllib.error.URLError, TimeoutError):
            self.send_json({"error": "AI 服务响应超时，请稍后重试"}, HTTPStatus.GATEWAY_TIMEOUT)

    def parse_multipart(self):
        content_type = self.headers.get("Content-Type", "")
        if not content_type.lower().startswith("multipart/form-data"):
            raise ValueError("上传必须使用 multipart/form-data")
        length = int(self.headers.get("Content-Length", "0"))
        max_bytes = min(setting_value("uploads.max_bytes", 12_000_000), 12_000_000)
        if length <= 0 or length > max_bytes:
            raise ValueError(f"图片大小必须在 1B 到 {max_bytes}B 之间")
        raw = self.rfile.read(length)
        match = re.search(r"boundary=([^;]+)", content_type)
        if not match:
            raise ValueError("上传边界无效")
        boundary = match.group(1).strip().strip('"').encode()
        parts = raw.split(b"--" + boundary)
        fields = {}
        upload = None
        for part in parts:
            if b"\r\n\r\n" not in part:
                continue
            header, value = part.split(b"\r\n\r\n", 1)
            value = value.rstrip(b"\r\n-")
            disposition = re.search(br'Content-Disposition:.*?name="([^"]+)"(?:; filename="([^"]*)")?', header, re.I | re.S)
            if not disposition:
                continue
            field = disposition.group(1).decode("utf-8", "ignore")
            filename = disposition.group(2).decode("utf-8", "ignore") if disposition.group(2) else ""
            if filename:
                upload = {"field": field, "filename": filename, "content": value, "content_type": (re.search(br"Content-Type:\s*([^\r\n]+)", header, re.I) or [b"", b""])[1].decode().strip()}
            else:
                fields[field] = value.decode("utf-8", "ignore")
        if not upload:
            raise ValueError("没有收到图片文件")
        return fields, upload

    def cookie(self, name):
        header = self.headers.get("Cookie", "")
        for item in header.split(";"):
            key, _, value = item.strip().partition("=")
            if key == name:
                return value
        return None

    def user(self):
        token = self.cookie(COOKIE_NAME)
        session = SESSIONS.get(token or "")
        if not session or session["expires"] < time.time():
            if token:
                SESSIONS.pop(token, None)
            return None
        return session

    def csrf_ok(self, session):
        return hmac.compare_digest(str(session.get("csrf", "")), self.headers.get(CSRF_HEADER, ""))

    def require_user(self):
        session = self.user()
        if not session:
            self.send_json({"error": "需要登录"}, HTTPStatus.UNAUTHORIZED)
            return None
        if self.command in {"POST", "PATCH", "DELETE"} and setting_value("security.require_csrf", True) and not self.csrf_ok(session):
            self.send_json({"error": "安全校验失败，请刷新页面后重试"}, HTTPStatus.FORBIDDEN)
            return None
        self.current_session = session
        return session["username"]

    def require_role(self, minimum):
        username = self.require_user()
        if not username:
            return None
        session = self.current_session
        if not role_at_least(session.get("role"), minimum):
            self.send_json({"error": "没有执行此操作的权限"}, HTTPStatus.FORBIDDEN)
            return None
        return username

    def audit(self, username, action, entity_type, entity_id=None, detail=None):
        connection = db()
        connection.execute(
            "INSERT INTO admin_audit_log(username,action,entity_type,entity_id,detail_json) VALUES(?,?,?,?,?)",
            (username, action, entity_type, str(entity_id or ""), json.dumps(detail or {}, ensure_ascii=False)),
        )
        connection.commit()
        connection.close()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json({"ok": True, "database": str(DB_PATH)})
            return
        if parsed.path.startswith("/api/"):
            self.api_get(parsed)
            return
        self.static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            try:
                self.api_post(parsed)
            except ValueError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            try:
                self.api_patch(parsed)
            except ValueError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_OPTIONS(self):
        origin = self.allowed_cors_origin()
        if not origin:
            self.send_json({"error": "不允许的跨域来源"}, HTTPStatus.FORBIDDEN)
            return
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-YADILO-CSRF")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.end_headers()

    def static(self, path):
        relative = "admin.html" if path in ("/", "/admin", "/admin.html") else path.lstrip("/")
        target = (ROOT / relative).resolve()
        if ROOT not in target.parents and target != ROOT:
            self.send_text("not found", status=HTTPStatus.NOT_FOUND)
            return
        if not target.is_file():
            self.send_text("not found", status=HTTPStatus.NOT_FOUND)
            return
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_text(target.read_bytes(), content_type)

    def api_get(self, parsed):
        user = self.require_user() if parsed.path not in ("/api/auth/me",) else self.user()
        if parsed.path == "/api/auth/me":
            self.send_json({"authenticated": bool(user), "username": user.get("username") if user else None, "role": user.get("role") if user else None, "csrf": user.get("csrf") if user else None})
            return
        if not user:
            return
        connection = db()
        query = parse_qs(parsed.query)
        try:
            if parsed.path == "/api/dashboard":
                data = {
                    "products": connection.execute("SELECT COUNT(*) FROM products WHERE active=1").fetchone()[0],
                    "configurable": connection.execute("SELECT COUNT(*) FROM products WHERE active=1 AND configurator_key IS NOT NULL").fetchone()[0],
                    "schemes": connection.execute("SELECT COUNT(*) FROM saved_schemes").fetchone()[0],
                    "new_consultations": connection.execute("SELECT COUNT(*) FROM consultations WHERE status='new'").fetchone()[0],
                    "price_rules": connection.execute("SELECT COUNT(*) FROM price_rules").fetchone()[0],
                    "assets": connection.execute("SELECT COUNT(*) FROM asset_references").fetchone()[0],
                    "recent_consultations": rows(connection, "SELECT id,customer_name,phone,product_label,status,created_at FROM consultations ORDER BY id DESC LIMIT 8"),
                }
                self.send_json(data)
            elif parsed.path == "/api/catalog-audit":
                if not role_at_least(self.current_session.get("role"), "editor"):
                    self.send_json({"error": "没有执行此操作的权限"}, HTTPStatus.FORBIDDEN)
                else:
                    self.send_json(catalog_audit(connection))
            elif parsed.path == "/api/admin-users":
                if not role_at_least(self.current_session.get("role"), "admin"):
                    self.send_json({"error": "没有执行此操作的权限"}, HTTPStatus.FORBIDDEN)
                else:
                    self.send_json(rows(connection, "SELECT id,username,display_name,role,dealer_id,active,created_at,updated_at FROM admin_users ORDER BY id"))
            elif parsed.path == "/api/dealers":
                if not role_at_least(self.current_session.get("role"), "dealer_manager"):
                    self.send_json({"error": "没有执行此操作的权限"}, HTTPStatus.FORBIDDEN)
                else:
                    self.send_json(rows(connection, "SELECT d.*,COUNT(u.id) user_count FROM dealers d LEFT JOIN admin_users u ON u.dealer_id=d.id GROUP BY d.id ORDER BY d.updated_at DESC"))
            elif parsed.path == "/api/settings":
                if not role_at_least(self.current_session.get("role"), "admin"):
                    self.send_json({"error": "没有执行此操作的权限"}, HTTPStatus.FORBIDDEN)
                else:
                    self.send_json(rows(connection, "SELECT * FROM system_settings ORDER BY setting_key"))
            elif parsed.path == "/api/products":
                search = query.get("q", [""])[0].strip()
                params = []
                clause = ""
                if search:
                    clause = "WHERE p.name LIKE ? OR p.product_key LIKE ? OR COALESCE(p.configurator_key,'') LIKE ?"
                    params = [f"%{search}%"] * 3
                self.send_json(rows(connection, f"""
                    SELECT p.id,p.product_key,p.name,p.configurator_key,p.active,p.catalog_serial,p.style,
                           s.name AS series_name,dt.name AS default_type_name
                    FROM products p JOIN product_series s ON s.id=p.series_id
                    LEFT JOIN product_door_types pdt ON pdt.product_id=p.id AND pdt.is_default=1
                    LEFT JOIN door_types dt ON dt.id=pdt.door_type_id {clause}
                    ORDER BY p.active DESC, p.id DESC LIMIT 500
                """, params))
            elif parsed.path == "/api/products/detail":
                product_id = int(query.get("id", [0])[0])
                product = row(connection, "SELECT p.*,s.name series_name FROM products p JOIN product_series s ON s.id=p.series_id WHERE p.id=?", (product_id,))
                if not product:
                    self.send_json({"error": "产品不存在"}, HTTPStatus.NOT_FOUND)
                else:
                    product["attributes"] = rows(connection, "SELECT attribute_key,attribute_value,value_type FROM product_attributes WHERE product_id=? ORDER BY attribute_key", (product_id,))
                    product["types"] = rows(connection, """SELECT dt.*,pdt.is_default,dr.width_min_mm,dr.width_default_mm,dr.width_max_mm,dr.height_min_mm,dr.height_default_mm,dr.height_max_mm,dr.minimum_area_sqm,dr.maximum_area_sqm,dr.panel_thickness_mm,dr.door_depth_mm,dr.frame_depth_mm,dr.casing_depth_mm,dr.lock_gap_mm,dr.lock_height_mm,dr.notes
                        FROM product_door_types pdt JOIN door_types dt ON dt.id=pdt.door_type_id LEFT JOIN dimension_rules dr ON dr.product_id=pdt.product_id AND dr.door_type_id=pdt.door_type_id WHERE pdt.product_id=? ORDER BY dt.id""", (product_id,))
                    product["options"] = rows(connection, """SELECT o.id,o.option_key,o.name,og.name group_name,po.is_default,po.is_required,po.price_override_cents,o.price_cents AS base_price_cents,COALESCE(po.price_override_cents,o.price_cents) price_cents,po.compatibility_note
                        FROM product_options po JOIN options o ON o.id=po.option_id JOIN option_groups og ON og.id=o.option_group_id WHERE po.product_id=? ORDER BY og.sort_order,o.id""", (product_id,))
                    product["prices"] = rows(connection, "SELECT * FROM price_rules WHERE product_id=? ORDER BY id DESC", (product_id,))
                    product["assets"] = rows(connection, "SELECT * FROM asset_references WHERE product_id=? ORDER BY is_primary DESC,id", (product_id,))
                    product["all_options"] = rows(connection, "SELECT o.id,o.option_key,o.name,o.note,o.price_cents,o.unit,o.active,og.code group_code,og.name group_name FROM options o JOIN option_groups og ON og.id=o.option_group_id WHERE o.active=1 ORDER BY og.sort_order,o.id")
                    for option in product["options"]:
                        option["door_type_ids"] = [item["door_type_id"] for item in rows(connection, "SELECT door_type_id FROM product_door_type_options WHERE product_id=? AND option_id=? AND compatible=1", (product_id, option["id"]))]
                    self.send_json(product)
            elif parsed.path == "/api/door-types":
                self.send_json(rows(connection, "SELECT * FROM door_types WHERE active=1 ORDER BY id"))
            elif parsed.path == "/api/option-groups":
                self.send_json(rows(connection, "SELECT * FROM option_groups ORDER BY sort_order,id"))
            elif parsed.path == "/api/assets":
                product_id = as_int(query.get("product_id", [0])[0])
                if product_id:
                    self.send_json(rows(connection, "SELECT ar.*,p.name product_name,o.name option_name FROM asset_references ar LEFT JOIN products p ON p.id=ar.product_id LEFT JOIN options o ON o.id=ar.option_id WHERE ar.product_id=? ORDER BY ar.is_primary DESC,ar.id DESC", (product_id,)))
                else:
                    self.send_json(rows(connection, "SELECT ar.*,p.name product_name,o.name option_name FROM asset_references ar LEFT JOIN products p ON p.id=ar.product_id LEFT JOIN options o ON o.id=ar.option_id ORDER BY ar.is_primary DESC,ar.id DESC LIMIT 1000"))
            elif parsed.path == "/api/options":
                self.send_json(rows(connection, "SELECT o.*,og.code group_code,og.name group_name FROM options o JOIN option_groups og ON og.id=o.option_group_id ORDER BY og.sort_order,o.id"))
            elif parsed.path == "/api/consultations":
                status = query.get("status", [""])[0]
                clause = "WHERE status=?" if status else ""
                params = (status,) if status else ()
                items = rows(connection, f"SELECT * FROM consultations {clause} ORDER BY id DESC LIMIT 500", params)
                for item in items:
                    item["config"] = json_value(item.pop("config_json", "{}"), {})
                    item["order_payload"] = json_value(item.pop("order_payload_json", "{}"), {})
                self.send_json(items)
            elif parsed.path == "/api/schemes":
                self.send_json(rows(connection, "SELECT id,external_id,title,series,product,product_label,status,created_at,updated_at FROM saved_schemes ORDER BY updated_at DESC LIMIT 500"))
            elif parsed.path == "/api/schemes/detail":
                item = row(connection, "SELECT * FROM saved_schemes WHERE id=?", (int(query.get("id", [0])[0]),))
                if item:
                    for key in ("config_json", "order_payload_json", "ai_scenes_json"):
                        item[key[:-5] if key.endswith("_json") else key] = json_value(item[key], {} if key != "ai_scenes_json" else [])
                self.send_json(item or {"error": "方案不存在"}, HTTPStatus.OK if item else HTTPStatus.NOT_FOUND)
            elif parsed.path == "/api/sources":
                self.send_json(rows(connection, "SELECT id,title,file_path,document_type,page_count,imported_at FROM source_documents ORDER BY imported_at DESC"))
            elif parsed.path == "/api/design-guide":
                self.send_json({
                    "title": "雅帝乐基础产品设计指导手册",
                    "file_path": "assets/source/docs/design-guide/design-guide.pdf",
                    "preview_pages": [f"assets/generated/pdf-previews/design-guide/page-{page:02d}.jpg" for page in range(3, 11)],
                    "principles": ["CMFP：色彩 / 材料 / 表面处理工艺 / 图形纹理", "组件：门套 / 门框 / 正背面结构板 / 外饰面板 / 内外五金", "尺寸：门扇、门框、门套、锁孔间隙与锁孔高度"],
                })
            elif parsed.path == "/api/audit":
                self.send_json(rows(connection, "SELECT * FROM admin_audit_log ORDER BY id DESC LIMIT 300"))
            else:
                self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        finally:
            connection.close()

    def api_post(self, parsed):
        if parsed.path == "/api/assets/upload":
            user = self.require_role("editor")
            if not user:
                return
            try:
                fields, upload = self.parse_multipart()
                extension = Path(upload["filename"]).suffix.lower().lstrip(".")
                allowed_types = {str(item).lower() for item in setting_value("uploads.allowed_types", list(ALLOWED_UPLOADS))}
                if extension not in ALLOWED_UPLOADS or extension not in allowed_types:
                    raise ValueError("仅支持 JPG、PNG、WEBP、GIF 图片")
                if upload["content_type"] and upload["content_type"] != ALLOWED_UPLOADS[extension]:
                    raise ValueError("图片类型与文件扩展名不匹配")
                image_type = imghdr.what(None, h=upload["content"])
                if image_type not in {"jpeg", "png", "gif", "webp"}:
                    raise ValueError("文件内容不是有效图片")
                product_id = as_int(fields.get("product_id"))
                option_id = as_int(fields.get("option_id"))
                connection = db()
                if product_id:
                    validate_product_id(connection, product_id)
                if option_id and (not product_id or not row(connection, "SELECT 1 FROM product_options WHERE product_id=? AND option_id=?", (product_id, option_id))):
                    raise ValueError("上传资产的选配未关联到产品")
                asset_role = safe_name(fields.get("asset_role") or "uploaded-image")
                filename = f"{secrets.token_hex(12)}-{safe_name(Path(upload['filename']).stem)}.{extension}"
                target = UPLOAD_ROOT / filename
                target.write_bytes(upload["content"])
                relative_path = str(target.relative_to(ROOT)).replace(os.sep, "/")
                if as_bool(fields.get("is_primary")) and product_id:
                    connection.execute("UPDATE asset_references SET is_primary=0 WHERE product_id=? AND asset_role=?", (product_id, asset_role))
                cur = connection.execute("INSERT INTO asset_references(product_id,option_id,asset_role,file_path,is_primary,metadata_json) VALUES(?,?,?,?,?,?)", (product_id, option_id, asset_role, relative_path, as_bool(fields.get("is_primary")), json.dumps({"original_name": upload["filename"], "content_type": upload["content_type"], "bytes": len(upload["content"]), "uploaded_by": user}, ensure_ascii=False)))
                connection.commit(); connection.close()
                self.audit(user, "upload", "asset_reference", cur.lastrowid, {"path": relative_path, "bytes": len(upload["content"])})
                self.send_json({"ok": True, "id": cur.lastrowid, "file_path": relative_path}, HTTPStatus.CREATED)
            except (ValueError, sqlite3.Error) as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
            return
        try:
            payload = self.parse_body()
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
            return
        if parsed.path == "/api/auth/login":
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))
            now = time.time()
            login_window = setting_value("security.login_window", LOGIN_WINDOW)
            login_limit = setting_value("security.login_limit", LOGIN_LIMIT)
            failures = [stamp for stamp in LOGIN_FAILURES.get(username, []) if now - stamp < login_window]
            if len(failures) >= login_limit:
                self.send_json({"error": "登录尝试过于频繁，请稍后再试"}, HTTPStatus.TOO_MANY_REQUESTS)
                return
            connection = db()
            found = connection.execute("SELECT id,username,password_hash,display_name,role,dealer_id FROM admin_users WHERE username=? AND active=1", (username,)).fetchone()
            connection.close()
            if not found or not verify_password(password, found["password_hash"]):
                failures.append(now); LOGIN_FAILURES[username] = failures[-login_limit:]
                self.send_json({"error": "账号或密码错误"}, HTTPStatus.UNAUTHORIZED)
                return
            LOGIN_FAILURES.pop(username, None)
            token = secrets.token_urlsafe(32)
            csrf = secrets.token_urlsafe(24)
            session_ttl = setting_value("security.session_ttl", SESSION_TTL)
            SESSIONS[token] = {"user_id": found["id"], "username": username, "role": found["role"] or "viewer", "dealer_id": found["dealer_id"], "csrf": csrf, "expires": time.time() + session_ttl}
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            host = self.headers.get("Host", "").split(":")[0].lower()
            secure = "; Secure" if host not in {"127.0.0.1", "localhost", "::1"} else ""
            self.send_header("Set-Cookie", f"{COOKIE_NAME}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={session_ttl}{secure}")
            body = json.dumps({"ok": True, "username": username, "role": found["role"], "csrf": csrf}, ensure_ascii=False).encode()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/auth/logout":
            session = self.user()
            token = self.cookie(COOKIE_NAME)
            SESSIONS.pop(token or "", None)
            self.send_json({"ok": True})
            return
        if parsed.path == "/api/auth/password":
            session = self.require_user()
            if not session:
                return
            old_password = str(payload.get("old_password", "")); new_password = str(payload.get("new_password", ""))
            if len(new_password) < 12:
                self.send_json({"error": "新密码至少 12 位"}, HTTPStatus.BAD_REQUEST); return
            connection = db(); found = connection.execute("SELECT password_hash FROM admin_users WHERE id=?", (self.current_session["user_id"],)).fetchone()
            if not found or not verify_password(old_password, found["password_hash"]):
                connection.close(); self.send_json({"error": "当前密码不正确"}, HTTPStatus.BAD_REQUEST); return
            connection.execute("UPDATE admin_users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (hash_password(new_password), self.current_session["user_id"])); connection.commit(); connection.close()
            self.audit(session, "password", "admin_user", self.current_session["user_id"])
            self.send_json({"ok": True}); return
        if parsed.path == "/api/public/schemes":
            self.save_public_scheme(payload)
            return
        if parsed.path == "/api/public/consultations":
            self.save_public_consultation(payload)
            return
        if parsed.path == "/api/ai/generate":
            self.proxy_ai_generation(payload)
            return
        user = self.require_role("editor")
        if not user:
            return
        connection = db()
        try:
            if parsed.path == "/api/admin-users":
                if not role_at_least(self.current_session.get("role"), "super_admin"):
                    self.send_json({"error": "仅超级管理员可以创建管理员"}, HTTPStatus.FORBIDDEN); return
                username = validate_username(payload.get("username"))
                password = str(payload.get("password", ""))
                display_name = str(payload.get("display_name", "")).strip() or username
                role = payload.get("role", "viewer")
                if len(username) < 3 or len(password) < 12 or role not in ROLE_LEVELS:
                    self.send_json({"error": "账号至少 3 位，密码至少 12 位，角色无效"}, HTTPStatus.BAD_REQUEST); return
                if row(connection, "SELECT id FROM admin_users WHERE username=?", (username,)):
                    self.send_json({"error": "管理员账号已存在"}, HTTPStatus.CONFLICT); return
                dealer_id = as_int(payload.get("dealer_id"))
                if dealer_id and not row(connection, "SELECT id FROM dealers WHERE id=? AND status != 'closed'", (dealer_id,)):
                    self.send_json({"error": "经销商不存在或已关闭"}, HTTPStatus.BAD_REQUEST); return
                cur = connection.execute("INSERT INTO admin_users(username,password_hash,display_name,role,dealer_id,active) VALUES(?,?,?,?,?,1)", (username, hash_password(password), display_name, role, dealer_id))
                connection.commit(); self.audit(user, "create", "admin_user", cur.lastrowid, {"username": username, "role": role}); self.send_json({"ok": True, "id": cur.lastrowid}, HTTPStatus.CREATED)
            elif parsed.path == "/api/dealers":
                if not role_at_least(self.current_session.get("role"), "dealer_manager"):
                    self.send_json({"error": "没有经销商管理权限"}, HTTPStatus.FORBIDDEN); return
                code = validate_username(payload.get("dealer_code")); name = str(payload.get("name", "")).strip()
                if not name or len(code) < 2:
                    self.send_json({"error": "经销商名称和编码不能为空"}, HTTPStatus.BAD_REQUEST); return
                level = payload.get("level", "standard"); status = payload.get("status", "pending")
                if level not in {"standard", "silver", "gold", "strategic"} or status not in {"pending", "active", "suspended", "closed"}:
                    self.send_json({"error": "经销商状态或等级无效"}, HTTPStatus.BAD_REQUEST); return
                cur = connection.execute("INSERT INTO dealers(dealer_code,name,contact_name,phone,email,region,address,level,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?)", (code, name, payload.get("contact_name"), payload.get("phone"), payload.get("email"), payload.get("region"), payload.get("address"), level, status, payload.get("notes")))
                connection.commit(); self.audit(user, "create", "dealer", cur.lastrowid, {"dealer_code": code}); self.send_json({"ok": True, "id": cur.lastrowid}, HTTPStatus.CREATED)
            elif parsed.path == "/api/settings":
                if not role_at_least(self.current_session.get("role"), "admin"):
                    self.send_json({"error": "没有系统配置权限"}, HTTPStatus.FORBIDDEN); return
                key = str(payload.get("setting_key", "")).strip(); value_type = payload.get("value_type", "text")
                value = validate_setting(key, value_type, payload.get("setting_value", ""))
                connection.execute("INSERT INTO system_settings(setting_key,setting_value,value_type,description,is_public,updated_by,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,value_type=excluded.value_type,description=excluded.description,is_public=excluded.is_public,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP", (key, value, value_type, payload.get("description"), as_bool(payload.get("is_public")), user))
                connection.commit(); self.audit(user, "upsert", "system_setting", key, {"value_type": value_type}); self.send_json({"ok": True})
            elif parsed.path == "/api/schemes":
                external_id = str(payload.get("id") or secrets.token_urlsafe(12))
                connection.execute("""INSERT INTO saved_schemes(external_id,title,series,product,product_label,status,config_json,order_payload_json,ai_scenes_json)
                    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(external_id) DO UPDATE SET title=excluded.title,series=excluded.series,product=excluded.product,product_label=excluded.product_label,config_json=excluded.config_json,order_payload_json=excluded.order_payload_json,ai_scenes_json=excluded.ai_scenes_json,updated_at=CURRENT_TIMESTAMP""",
                    (external_id, payload.get("title") or "私人定制方案", payload.get("series"), payload.get("product"), payload.get("productLabel"), payload.get("status", "draft"), json.dumps(payload.get("config", {}), ensure_ascii=False), json.dumps(payload.get("orderPayload", {}), ensure_ascii=False), json.dumps(payload.get("aiScenes", []), ensure_ascii=False)))
                connection.commit()
                item = row(connection, "SELECT * FROM saved_schemes WHERE external_id=?", (external_id,))
                self.audit(user, "upsert", "scheme", external_id, {"title": item["title"]})
                self.send_json({"ok": True, "id": external_id})
            elif parsed.path == "/api/consultations":
                name, phone = str(payload.get("name", "")).strip(), str(payload.get("phone", "")).strip()
                if not name or not phone:
                    self.send_json({"error": "称呼和手机号不能为空"}, HTTPStatus.BAD_REQUEST)
                    return
                cur = connection.execute("""INSERT INTO consultations(customer_name,phone,city,message,source,series,product,product_label,status,config_json,order_payload_json)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (name, phone, payload.get("city"), payload.get("message"), payload.get("source", "website"), payload.get("series"), payload.get("product"), payload.get("productLabel"), "new", json.dumps(payload.get("config", {}), ensure_ascii=False), json.dumps(payload.get("orderPayload", {}), ensure_ascii=False)))
                connection.commit()
                self.audit(user or "website", "create", "consultation", cur.lastrowid, {"phone": phone})
                self.send_json({"ok": True, "id": cur.lastrowid}, HTTPStatus.CREATED)
            elif parsed.path == "/api/products/attributes":
                product_id = as_int(payload.get("product_id"))
                if not product_id or not row(connection, "SELECT id FROM products WHERE id=?", (product_id,)):
                    self.send_json({"error": "产品不存在"}, HTTPStatus.NOT_FOUND)
                    return
                for item in payload.get("attributes", []):
                    key = str(item.get("attribute_key", "")).strip()
                    if not key:
                        continue
                    value = item.get("attribute_value")
                    value_type = item.get("value_type", "text")
                    if value_type == "json":
                        value = json_text(value, {}) if not isinstance(value, str) else value
                    elif value_type == "number":
                        value = str(value)
                    elif value_type == "boolean":
                        value = "1" if as_bool(value) else "0"
                    connection.execute("""INSERT INTO product_attributes(product_id,attribute_key,attribute_value,value_type)
                        VALUES(?,?,?,?) ON CONFLICT(product_id,attribute_key) DO UPDATE SET attribute_value=excluded.attribute_value,value_type=excluded.value_type""", (product_id, key, value, value_type))
                connection.commit()
                self.audit(user, "update", "product_attributes", product_id, {"count": len(payload.get("attributes", []))})
                self.send_json({"ok": True})
            elif parsed.path == "/api/products/types":
                product_id = as_int(payload.get("product_id"))
                if not product_id:
                    self.send_json({"error": "缺少产品"}, HTTPStatus.BAD_REQUEST)
                    return
                selected = payload.get("types", [])
                validate_product_configuration(connection, product_id, selected)
                connection.execute("DELETE FROM product_door_types WHERE product_id=?", (product_id,))
                connection.execute("DELETE FROM dimension_rules WHERE product_id=?", (product_id,))
                for item in selected:
                    type_id = as_int(item.get("door_type_id"))
                    dims = validate_dimension(item)
                    connection.execute("INSERT INTO product_door_types(product_id,door_type_id,is_default) VALUES(?,?,?)", (product_id, type_id, as_bool(item.get("is_default"))))
                    connection.execute("""INSERT INTO dimension_rules(product_id,door_type_id,width_min_mm,width_default_mm,width_max_mm,height_min_mm,height_default_mm,height_max_mm,minimum_area_sqm,panel_thickness_mm,door_depth_mm,frame_depth_mm,casing_depth_mm,lock_gap_mm,lock_height_mm,notes)
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (product_id, type_id, dims["width_min_mm"], dims["width_default_mm"], dims["width_max_mm"], dims["height_min_mm"], dims["height_default_mm"], dims["height_max_mm"], as_float(item.get("minimum_area_sqm")), as_float(item.get("panel_thickness_mm")), as_float(item.get("door_depth_mm")), as_float(item.get("frame_depth_mm")), as_float(item.get("casing_depth_mm")), as_float(item.get("lock_gap_mm")), as_float(item.get("lock_height_mm")), item.get("notes")))
                connection.commit()
                self.audit(user, "replace", "product_door_types", product_id, {"count": len(selected)})
                self.send_json({"ok": True})
            elif parsed.path == "/api/products/options":
                product_id = as_int(payload.get("product_id"))
                if not product_id:
                    self.send_json({"error": "缺少产品"}, HTTPStatus.BAD_REQUEST)
                    return
                selected = payload.get("options", [])
                type_ids = {item["door_type_id"] for item in rows(connection, "SELECT door_type_id FROM product_door_types WHERE product_id=?", (product_id,))}
                if not type_ids:
                    raise ValueError("请先保存产品支持的门型")
                option_ids = [as_int(item.get("option_id")) for item in selected]
                if any(not option_id for option_id in option_ids) or len(set(option_ids)) != len(option_ids):
                    raise ValueError("选配不能为空且不能重复")
                known_options = {item["id"] for item in rows(connection, "SELECT id FROM options WHERE active=1")}
                if not set(option_ids).issubset(known_options):
                    raise ValueError("包含无效或已停用的选配")
                groups = rows(connection, "SELECT o.id,og.code FROM options o JOIN option_groups og ON og.id=o.option_group_id WHERE o.id IN (%s)" % ",".join("?" * len(option_ids)), option_ids) if option_ids else []
                single_groups = {item["code"] for item in rows(connection, "SELECT code FROM option_groups WHERE selection_mode='single'")}
                defaults = {item["code"]: 0 for item in groups if item["code"] in single_groups}
                for item in selected:
                    group_code = next((group["code"] for group in groups if group["id"] == as_int(item.get("option_id"))), None)
                    if group_code in defaults:
                        defaults[group_code] += as_bool(item.get("is_default"))
                    compatible = set(as_int(value) for value in (item.get("door_type_ids") or type_ids))
                    if not compatible.issubset(type_ids):
                        raise ValueError("选配兼容门型必须属于产品支持门型")
                    if as_int(item.get("price_override_cents")) is not None and as_int(item.get("price_override_cents")) < 0:
                        raise ValueError("选配价格不能为负数")
                if any(value > 1 for value in defaults.values()):
                    raise ValueError("单选选配组最多只能有一个默认值")
                connection.execute("DELETE FROM product_options WHERE product_id=?", (product_id,))
                connection.execute("DELETE FROM product_door_type_options WHERE product_id=?", (product_id,))
                for item in selected:
                    option_id = as_int(item.get("option_id"))
                    connection.execute("""INSERT INTO product_options(product_id,option_id,is_default,is_required,price_override_cents,compatibility_note)
                        VALUES(?,?,?,?,?,?)""", (product_id, option_id, as_bool(item.get("is_default")), as_bool(item.get("is_required")), as_int(item.get("price_override_cents")), item.get("compatibility_note")))
                    compatible_types = item.get("door_type_ids") or list(type_ids)
                    for type_id in compatible_types:
                        connection.execute("INSERT INTO product_door_type_options(product_id,door_type_id,option_id,compatible,note) VALUES(?,?,?,?,?)", (product_id, as_int(type_id), option_id, 1, item.get("compatibility_note")))
                connection.commit()
                self.audit(user, "replace", "product_options", product_id, {"count": len(selected)})
                self.send_json({"ok": True})
            elif parsed.path == "/api/price-rules":
                product_id = as_int(payload.get("product_id"))
                price_kind = payload.get("price_kind")
                if not product_id or price_kind not in {"base_area", "finish_area", "option", "per_meter", "per_leaf", "fixed", "surcharge", "formula"}:
                    self.send_json({"error": "价格规则字段无效"}, HTTPStatus.BAD_REQUEST)
                    return
                amount = as_int(payload.get("amount_cents"))
                if amount is not None and amount < 0:
                    self.send_json({"error": "价格不能为负数"}, HTTPStatus.BAD_REQUEST)
                    return
                validate_product_id(connection, product_id)
                door_type_id = as_int(payload.get("door_type_id"))
                option_id = as_int(payload.get("option_id"))
                if door_type_id and not row(connection, "SELECT 1 FROM product_door_types WHERE product_id=? AND door_type_id=?", (product_id, door_type_id)):
                    self.send_json({"error": "价格规则门型未被产品支持"}, HTTPStatus.BAD_REQUEST)
                    return
                if option_id and not row(connection, "SELECT 1 FROM product_options WHERE product_id=? AND option_id=?", (product_id, option_id)):
                    self.send_json({"error": "价格规则选配未关联到产品"}, HTTPStatus.BAD_REQUEST)
                    return
                cur = connection.execute("""INSERT INTO price_rules(product_id,door_type_id,option_id,price_kind,amount_cents,unit,formula,effective_from,effective_to,notes,source_locator)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (product_id, door_type_id, option_id, price_kind, amount, payload.get("unit", "each"), payload.get("formula"), payload.get("effective_from"), payload.get("effective_to"), payload.get("notes"), payload.get("source_locator")))
                connection.commit()
                self.audit(user, "create", "price_rule", cur.lastrowid, {"product_id": product_id, "price_kind": price_kind})
                self.send_json({"ok": True, "id": cur.lastrowid}, HTTPStatus.CREATED)
            elif parsed.path == "/api/assets":
                product_id = as_int(payload.get("product_id"))
                file_path = str(payload.get("file_path", "")).strip()
                if not product_id or not file_path:
                    self.send_json({"error": "产品和资产路径不能为空"}, HTTPStatus.BAD_REQUEST)
                    return
                validate_product_id(connection, product_id)
                option_id = as_int(payload.get("option_id"))
                if option_id and not row(connection, "SELECT 1 FROM product_options WHERE product_id=? AND option_id=?", (product_id, option_id)):
                    self.send_json({"error": "资产选配未关联到产品"}, HTTPStatus.BAD_REQUEST)
                    return
                if as_bool(payload.get("is_primary")):
                    connection.execute("UPDATE asset_references SET is_primary=0 WHERE product_id=? AND asset_role=?", (product_id, payload.get("asset_role", "asset")))
                cur = connection.execute("INSERT INTO asset_references(product_id,option_id,asset_role,file_path,is_primary,metadata_json) VALUES(?,?,?,?,?,?)", (product_id, option_id, payload.get("asset_role", "asset"), file_path, as_bool(payload.get("is_primary")), json_text(payload.get("metadata"), {})))
                connection.commit()
                self.audit(user, "create", "asset_reference", cur.lastrowid, {"product_id": product_id})
                self.send_json({"ok": True, "id": cur.lastrowid}, HTTPStatus.CREATED)
            else:
                self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        finally:
            connection.close()

    def save_public_scheme(self, payload):
        external_id = str(payload.get("id") or secrets.token_urlsafe(12))
        connection = db()
        try:
            connection.execute("""INSERT INTO saved_schemes(external_id,title,series,product,product_label,status,config_json,order_payload_json,ai_scenes_json)
                VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(external_id) DO UPDATE SET title=excluded.title,series=excluded.series,product=excluded.product,product_label=excluded.product_label,config_json=excluded.config_json,order_payload_json=excluded.order_payload_json,ai_scenes_json=excluded.ai_scenes_json,updated_at=CURRENT_TIMESTAMP""",
                (external_id, payload.get("title") or "私人定制方案", payload.get("series"), payload.get("product"), payload.get("productLabel"), payload.get("status", "draft"), json.dumps(payload.get("config", {}), ensure_ascii=False), json.dumps(payload.get("orderPayload", {}), ensure_ascii=False), json.dumps(payload.get("aiScenes", []), ensure_ascii=False)))
            connection.commit()
            self.send_json({"ok": True, "id": external_id})
        finally:
            connection.close()

    def save_public_consultation(self, payload):
        name, phone = str(payload.get("name", "")).strip(), str(payload.get("phone", "")).strip()
        if not name or not phone:
            self.send_json({"error": "称呼和手机号不能为空"}, HTTPStatus.BAD_REQUEST)
            return
        connection = db()
        try:
            cur = connection.execute("""INSERT INTO consultations(customer_name,phone,city,message,source,series,product,product_label,status,config_json,order_payload_json)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (name, phone, payload.get("city"), payload.get("message"), payload.get("source", "website"), payload.get("series"), payload.get("product"), payload.get("productLabel"), "new", json.dumps(payload.get("config", {}), ensure_ascii=False), json.dumps(payload.get("orderPayload", {}), ensure_ascii=False)))
            connection.commit()
            self.audit("website", "create", "consultation", cur.lastrowid, {"phone": phone})
            self.send_json({"ok": True, "id": cur.lastrowid}, HTTPStatus.CREATED)
        finally:
            connection.close()

    def api_patch(self, parsed):
        user = self.require_role("editor")
        if not user:
            return
        try:
            payload = self.parse_body()
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
            return
        connection = db()
        try:
            entity_id = int(parse_qs(urlparse(self.path).query).get("id", [0])[0])
            if parsed.path == "/api/admin-users":
                if not role_at_least(self.current_session.get("role"), "super_admin"):
                    self.send_json({"error": "仅超级管理员可以修改管理员"}, HTTPStatus.FORBIDDEN); return
                active = as_bool(payload.get("active"))
                role = payload.get("role")
                if role not in ROLE_LEVELS:
                    self.send_json({"error": "角色无效"}, HTTPStatus.BAD_REQUEST); return
                if entity_id == self.current_session.get("user_id") and not active:
                    self.send_json({"error": "不能停用当前登录账号"}, HTTPStatus.BAD_REQUEST); return
                if entity_id == self.current_session.get("user_id") and not role_at_least(role, "super_admin"):
                    self.send_json({"error": "不能降低当前超级管理员权限"}, HTTPStatus.BAD_REQUEST); return
                target = row(connection, "SELECT id,role FROM admin_users WHERE id=?", (entity_id,))
                if not target:
                    self.send_json({"error": "管理员不存在"}, HTTPStatus.NOT_FOUND); return
                if target["role"] == "super_admin" and (role != "super_admin" or not active):
                    remaining = connection.execute("SELECT COUNT(*) FROM admin_users WHERE role='super_admin' AND active=1 AND id != ?", (entity_id,)).fetchone()[0]
                    if remaining < 1:
                        self.send_json({"error": "至少保留一个可用超级管理员"}, HTTPStatus.BAD_REQUEST); return
                dealer_id = as_int(payload.get("dealer_id"))
                if dealer_id and not row(connection, "SELECT id FROM dealers WHERE id=? AND status != 'closed'", (dealer_id,)):
                    self.send_json({"error": "经销商不存在或已关闭"}, HTTPStatus.BAD_REQUEST); return
                display_name = str(payload.get("display_name", "")).strip() or target["id"]
                connection.execute("UPDATE admin_users SET display_name=?,role=?,dealer_id=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (display_name, role, dealer_id, active, entity_id))
                if payload.get("password"):
                    if len(str(payload["password"])) < 12:
                        self.send_json({"error": "密码至少 12 位"}, HTTPStatus.BAD_REQUEST); return
                    connection.execute("UPDATE admin_users SET password_hash=? WHERE id=?", (hash_password(str(payload["password"])), entity_id))
                connection.commit(); self.audit(user, "update", "admin_user", entity_id, {"role": role, "active": active}); self.send_json({"ok": True})
            elif parsed.path == "/api/dealers":
                if not role_at_least(self.current_session.get("role"), "dealer_manager"):
                    self.send_json({"error": "没有经销商管理权限"}, HTTPStatus.FORBIDDEN); return
                status = payload.get("status", "pending")
                level = payload.get("level", "standard")
                if status not in {"pending", "active", "suspended", "closed"} or level not in {"standard", "silver", "gold", "strategic"}:
                    self.send_json({"error": "经销商状态或等级无效"}, HTTPStatus.BAD_REQUEST); return
                connection.execute("UPDATE dealers SET name=?,contact_name=?,phone=?,email=?,region=?,address=?,level=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (payload.get("name"), payload.get("contact_name"), payload.get("phone"), payload.get("email"), payload.get("region"), payload.get("address"), level, status, payload.get("notes"), entity_id))
                connection.commit(); self.audit(user, "update", "dealer", entity_id, {"status": status, "level": level}); self.send_json({"ok": True})
            elif parsed.path == "/api/consultations":
                status = payload.get("status")
                if status not in {"new", "contacted", "quoted", "closed", "invalid"}:
                    self.send_json({"error": "状态无效"}, HTTPStatus.BAD_REQUEST)
                    return
                connection.execute("UPDATE consultations SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (status, entity_id))
                connection.commit()
                self.audit(user, "status", "consultation", entity_id, {"status": status})
                self.send_json({"ok": True})
            elif parsed.path == "/api/products":
                active = 1 if payload.get("active") else 0
                connection.execute("UPDATE products SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (active, entity_id))
                connection.commit()
                self.audit(user, "toggle", "product", entity_id, {"active": active})
                self.send_json({"ok": True})
            elif parsed.path == "/api/products/profile":
                name = str(payload.get("name", "")).strip()
                if not name:
                    self.send_json({"error": "产品名称不能为空"}, HTTPStatus.BAD_REQUEST)
                    return
                if not row(connection, "SELECT id FROM products WHERE id=?", (entity_id,)):
                    self.send_json({"error": "产品不存在"}, HTTPStatus.NOT_FOUND)
                    return
                connection.execute("""UPDATE products SET name=?,english_name=?,catalog_serial=?,style=?,line_code=?,configurator_key=?,thumbnail_path=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?""", (name, payload.get("english_name"), payload.get("catalog_serial"), payload.get("style"), payload.get("line_code"), payload.get("configurator_key"), payload.get("thumbnail_path"), as_bool(payload.get("active")), entity_id))
                connection.commit()
                self.audit(user, "update", "product", entity_id, {"name": name})
                self.send_json({"ok": True})
            elif parsed.path == "/api/options":
                option_id = entity_id
                name = str(payload.get("name", "")).strip()
                if not name:
                    self.send_json({"error": "选配名称不能为空"}, HTTPStatus.BAD_REQUEST)
                    return
                if not row(connection, "SELECT id FROM options WHERE id=?", (option_id,)):
                    self.send_json({"error": "选配不存在"}, HTTPStatus.NOT_FOUND)
                    return
                price = as_int(payload.get("price_cents"), 0)
                if price is None or price < 0:
                    self.send_json({"error": "价格必须是非负整数"}, HTTPStatus.BAD_REQUEST)
                    return
                connection.execute("UPDATE options SET name=?,note=?,price_cents=?,unit=?,active=?,metadata_json=? WHERE id=?", (name, payload.get("note"), price, payload.get("unit") or "each", as_bool(payload.get("active")), json_text(payload.get("metadata"), {}), option_id))
                connection.commit()
                self.audit(user, "update", "option", option_id, {"name": name, "active": as_bool(payload.get("active"))})
                self.send_json({"ok": True})
            elif parsed.path == "/api/price-rules":
                amount = as_int(payload.get("amount_cents"))
                if amount is not None and amount < 0:
                    self.send_json({"error": "价格不能为负数"}, HTTPStatus.BAD_REQUEST)
                    return
                connection.execute("UPDATE price_rules SET amount_cents=?,unit=?,formula=?,effective_from=?,effective_to=?,notes=?,source_locator=? WHERE id=?", (amount, payload.get("unit", "each"), payload.get("formula"), payload.get("effective_from"), payload.get("effective_to"), payload.get("notes"), payload.get("source_locator"), entity_id))
                connection.commit()
                self.audit(user, "update", "price_rule", entity_id, {"amount_cents": amount})
                self.send_json({"ok": True})
            elif parsed.path == "/api/schemes/status":
                status = payload.get("status")
                if status not in {"draft", "quoted", "archived"}:
                    self.send_json({"error": "方案状态无效"}, HTTPStatus.BAD_REQUEST)
                    return
                connection.execute("UPDATE saved_schemes SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (status, entity_id))
                connection.commit()
                self.audit(user, "status", "scheme", entity_id, {"status": status})
                self.send_json({"ok": True})
            else:
                self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        finally:
            connection.close()


def main():
    parser = argparse.ArgumentParser(description="YADILO admin server")
    parser.add_argument("--host", default=os.environ.get("YADILO_ADMIN_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("YADILO_ADMIN_PORT", "8787")))
    args = parser.parse_args()
    bootstrap()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"YADILO admin: http://{args.host}:{args.port}/admin.html")
    print(f"Database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
