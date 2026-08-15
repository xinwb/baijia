#!/usr/bin/env swift

import CoreImage
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

enum FrostedGlassError: Error, CustomStringConvertible {
    case usage
    case sourceUnavailable(String)
    case destinationUnavailable(String)
    case renderFailed
    case writeFailed

    var description: String {
        switch self {
        case .usage:
            return "usage: process-frosted-glass.swift <source> <target>"
        case let .sourceUnavailable(path):
            return "无法读取源图片: \(path)"
        case let .destinationUnavailable(path):
            return "无法创建目标图片: \(path)"
        case .renderFailed:
            return "磨砂玻璃图像处理失败"
        case .writeFailed:
            return "图片写入失败"
        }
    }
}

func fail(_ error: FrostedGlassError) -> Never {
    fputs("\(error.description)\n", stderr)
    exit(2)
}

let args = Array(CommandLine.arguments.dropFirst())
guard args.count == 2 else { fail(.usage) }

let sourceURL = URL(fileURLWithPath: args[0])
let targetURL = URL(fileURLWithPath: args[1])
guard let source = CIImage(contentsOf: sourceURL, options: [.applyOrientationProperty: true]) else {
    fail(.sourceUnavailable(args[0]))
}

let extent = source.extent.integral

// The source is a photographed interior.  A light blur removes identifiable
// furniture and reflections, while the desaturation and soft veil preserve the
// warm architectural colour that should still read as the same product.
let softened = source
    .applyingFilter("CIColorControls", parameters: [
        kCIInputSaturationKey: 0.62,
        kCIInputContrastKey: 0.78,
        kCIInputBrightnessKey: 0.035
    ])
    .applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: 3.8
    ])
    .cropped(to: extent)

let veilColor = CIColor(red: 0.82, green: 0.84, blue: 0.81, alpha: 0.24)
let veil = CIImage(color: veilColor).cropped(to: extent)
let frosted = veil
    .composited(over: softened)
    .cropped(to: extent)

let context = CIContext(options: [
    CIContextOption.useSoftwareRenderer: false
])
guard let rendered = context.createCGImage(frosted, from: extent) else {
    fail(.renderFailed)
}

try? FileManager.default.createDirectory(
    at: targetURL.deletingLastPathComponent(),
    withIntermediateDirectories: true
)
guard let destination = CGImageDestinationCreateWithURL(
    targetURL as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
) else {
    fail(.destinationUnavailable(args[1]))
}

CGImageDestinationAddImage(destination, rendered, [
    kCGImagePropertyPNGDictionary: [:]
] as CFDictionary)
guard CGImageDestinationFinalize(destination) else { fail(.writeFailed) }
