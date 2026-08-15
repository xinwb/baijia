import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let context = CIContext(options: [.workingColorSpace: NSNull()])
let arguments = CommandLine.arguments
guard arguments.count == 4 else {
    fputs("usage: make-texture-variants.swift input output mode\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
let mode = arguments[3]
guard let source = CIImage(contentsOf: inputURL) else {
    fputs("cannot read input\n", stderr)
    exit(3)
}

guard let controls = CIFilter(name: "CIColorControls") else { exit(4) }
controls.setValue(source, forKey: kCIInputImageKey)
if mode == "oak" {
    controls.setValue(1.18, forKey: kCIInputSaturationKey)
    controls.setValue(0.035, forKey: kCIInputBrightnessKey)
    controls.setValue(1.06, forKey: kCIInputContrastKey)
} else {
    controls.setValue(0.42, forKey: kCIInputSaturationKey)
    controls.setValue(-0.075, forKey: kCIInputBrightnessKey)
    controls.setValue(1.13, forKey: kCIInputContrastKey)
}
guard let controlled = controls.value(forKey: kCIOutputImageKey) as? CIImage else { exit(4) }

guard let hue = CIFilter(name: "CIHueAdjust") else { exit(5) }
hue.setValue(controlled, forKey: kCIInputImageKey)
hue.setValue(mode == "oak" ? 0.08 : -0.035, forKey: kCIInputAngleKey)
guard let result = hue.value(forKey: kCIOutputImageKey) as? CIImage else { exit(5) }

guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL, UTType.png.identifier as CFString, 1, nil
) else { exit(6) }
guard let cgImage = context.createCGImage(result, from: result.extent) else { exit(7) }
CGImageDestinationAddImage(destination, cgImage, nil)
CGImageDestinationFinalize(destination)
