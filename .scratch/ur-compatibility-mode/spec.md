# Alternating NF / UR compatibility mode

Implement an optional compatibility mode on the package encoder and playground.
The user authorized creating and pushing a branch and deploying the existing Fly.io playground.

- Alternate NF and UR display slots, starting with NF, using independent consecutive sequences.
- Preserve binary-only defaults and the lightweight core import; also expose UR-only output.
- Encode UR as standard ur:bytes; playground uses cashuB text for legacy readers.
- Allow the playground receiver to reconstruct formats independently and freeze the first completed result.
- Keep NF version-1 wire rules unchanged; bound UR output and respect QR capacity.
- Validate against the existing UR reference implementation, QR pixel round trips, and browser flows.
- Physical legacy-wallet testing remains necessary, especially unknown-frame handling and camera timing.
