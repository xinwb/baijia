# YADILO SQLite Catalog

`yadilo.sqlite` is the normalized catalog database for the door configurators.

Build or refresh it from the current catalog sources:

```bash
node tools/build-sqlite-catalog.mjs
```

The import is repeatable. It reads the generated Excel catalog, the K80 rule files, the D90/K80 configurator metadata, the texture manifest, local product assets, and the official price guide PDF.

The main data path is:

`product_series -> products -> product_door_types -> dimension_rules`

Configuration choices are normalized through:

`option_groups -> options -> product_options -> product_door_type_options`

Prices are kept separately in `price_rules`. PDF pages that still contain mixed or context-dependent pricing are preserved verbatim in `price_references` so they can be normalized without losing the source wording. Every imported record also retains its original payload in `products.source_payload`.

The current seed includes all 401 Excel catalog records, including inactive records, so historical products are not silently deleted. The current configurator products receive normalized door-type, option, dimension, and product-specific modeling metadata where the front-end already defines it.

Useful read-only views are `v_configurable_products`, `v_product_options`, `v_product_dimensions`, and `v_price_book`.

## Python Back Office

The dependency-free Python service in the project root serves the static site,
the admin UI, and the SQLite API from one origin:

```bash
YADILO_ADMIN_PASSWORD='replace-this-password' python3 admin_server.py --host 0.0.0.0 --port 8787
```

Open `/admin.html`. The first run creates the `admin` user with the password
from `YADILO_ADMIN_PASSWORD` (or `change-me-now` for local development). Set a
real password before exposing the service. The public website can submit saved
schemes to `/api/public/schemes` and consultations to
`/api/public/consultations`; all catalog and back-office reads require the
admin session cookie.

Business tables are kept separate from the catalog import tables:

- `saved_schemes` stores K80/D90 configuration snapshots and order payloads.
- `consultations` stores customer contact requests and follow-up status.
- `admin_users` and `admin_audit_log` provide basic access control and traceability.
