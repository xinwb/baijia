#!/usr/bin/env swift

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

enum CropError: Error, CustomStringConvertible {
    case usage
    case sourceUnavailable(String)
    case destinationUnavailable(String)
    case invalidCrop
    case writeFailed

    var description: String {
        switch self {
        case .usage:
            return "usage: crop-image.swift <source> <target> <left> <top> <width> <height>"
        case let .sourceUnavailable(path):
            return "无法读取源图片: \(path)"
        case let .destinationUnavailable(path):
            return "无法创建目标图片: \(path)"
        case .invalidCrop:
            return "裁切区域超出图片范围或为空"
        case .writeFailed:
            return "图片写入失败"
        }
    }
}

func fail(_ error: CropError) -> Never {
    fputs("\(error.description)\n", stderr)
    exit(2)
}

let args = Array(CommandLine.arguments.dropFirst())
guard args.count == 6 else { fail(.usage) }

let sourceURL = URL(fileURLWithPath: args[0])
let targetURL = URL(fileURLWithPath: args[1])
guard let left = Int(args[2]), let top = Int(args[3]), let width = Int(args[4]), let height = Int(args[5]) else {
    fail(.usage)
}

guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fail(.sourceUnavailable(args[0]))
}

guard width > 0, height > 0,
      left >= 0, top >= 0,
      left + width <= image.width,
      top + height <= image.height else {
    fail(.invalidCrop)
}

// CGImage cropping uses a bottom-left coordinate, while asset specs use top-left.
let cropRect = CGRect(
    x: left,
    y: image.height - top - height,
    width: width,
    height: height
)
guard let cropped = image.cropping(to: cropRect) else { fail(.invalidCrop) }

try? FileManager.default.createDirectory(at: targetURL.deletingLastPathComponent(), withIntermediateDirectories: true)
guard let destination = CGImageDestinationCreateWithURL(
    targetURL as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
) else {
    fail(.destinationUnavailable(args[1]))
}

CGImageDestinationAddImage(destination, cropped, [
    kCGImagePropertyPNGDictionary: [:]
] as CFDictionary)
guard CGImageDestinationFinalize(destination) else { fail(.writeFailed) }
