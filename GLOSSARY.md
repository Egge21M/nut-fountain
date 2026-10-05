# Cashu fountain transport

This context covers transferring Cashu tokens through fountain encoding.

## Language

**Cashu token**:
A transferable collection of Cashu proofs with the mint and associated token metadata. The token can be represented as an object, encoded text, or binary data.

**Fountain frame**:
An individual encoded unit that contributes to reconstructing the original message when enough useful units have been received.

**Token version**:
The version of the Cashu token representation, identified by the token prefix. It is separate from the format used to transport the token.

**Fountain format version**:
The version of the binary fountain frame representation. It identifies the transport format independently of the contents being transferred.
