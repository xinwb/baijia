#!/usr/bin/env swift

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
    fputs("usage: make-alpha-cutout.swift <source> <target>\n", stderr)
    exit(2)
}

let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let targetURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fputs("无法读取源图片\n", stderr)
    exit(2)
}

let width = image.width
let height = image.height
let bytesPerRow = width * 4
var pixels = [UInt8](repeating: 0, count: bytesPerRow * height)
let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(
    data: &pixels,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fputs("无法创建图像缓冲区\n", stderr)
    exit(2)
}

context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

func isStudioWhite(_ index: Int) -> Bool {
    let offset = index * 4
    let r = pixels[offset]
    let g = pixels[offset + 1]
    let b = pixels[offset + 2]
    let minimum = min(r, min(g, b))
    let maximum = max(r, max(g, b))
    return minimum >= 232 && maximum - minimum <= 14
}

var visited = [Bool](repeating: false, count: width * height)
var queue = [Int]()
queue.reserveCapacity(width * 2 + height * 2)
for x in 0..<width {
    queue.append(x)
    queue.append((height - 1) * width + x)
}
for y in 0..<height {
    queue.append(y * width)
    queue.append(y * width + width - 1)
}

var cursor = 0
while cursor < queue.count {
    let index = queue[cursor]
    cursor += 1
    if visited[index] || !isStudioWhite(index) { continue }
    visited[index] = true
    let x = index % width
    let y = index / width
    if x > 0 { queue.append(index - 1) }
    if x + 1 < width { queue.append(index + 1) }
    if y > 0 { queue.append(index - width) }
    if y + 1 < height { queue.append(index + width) }
}

for index in 0..<(width * height) where visited[index] {
    pixels[index * 4 + 3] = 0
}

guard let outputImage = context.makeImage() else {
    fputs("无法生成透明图像\n", stderr)
    exit(2)
}
try? FileManager.default.createDirectory(at: targetURL.deletingLastPathComponent(), withIntermediateDirectories: true)
guard let destination = CGImageDestinationCreateWithURL(targetURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fputs("无法创建目标文件\n", stderr)
    exit(2)
}
CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else {
    fputs("透明图像写入失败\n", stderr)
    exit(2)
}
print("alpha cutout written: \(targetURL.path), background pixels: \(visited.filter { $0 }.count)")
