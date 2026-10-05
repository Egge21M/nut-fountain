# Public automatic decoder

Move format routing from the demo into the package. Expose AutoDecoder at the root and a dedicated subpath, alongside the existing scoped FountainDecoder and UrDecoder. Accept QR bytes and UR text, expose selected format, completion, payload bytes and progress, and support reset. Preserve scoped decoder behavior and wire formats. Switch the demo to the public API and remove its local routing implementation. Validate exports, browser compatibility, format selection, invalid input, session isolation, reset and both input representations; update the deployed demo.
