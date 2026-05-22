# Firebase Security Specification - 3D Chess rooms

This document defines the security boundaries, invariant rules, and hostile payloads verified against our Firestore access controls.

## 1. Data Invariants
1. **Move Control**: Moves can only be submitted by the player whose active turn matches the room's current turn state (`turn == 'w'` must match `whitePlayerId`, etc.).
2. **Terminal State Integrity**: When a chess game status is marked as "finished" or "draw", further piece operations, turn alterations, or FEN updates are strictly forbidden.
3. **Spectator Isolation**: A spectator cannot write or edit game moves or alter any `room` fields.
4. **Privilege Sanitation**: Users cannot directly increments wins/points without matching game status validation or self-modify other users' profiles.
5. **No Room Creep/Poisoning**: Room codes are restricted to valid text strings (up to 128 characters) and FEN coordinates must fit within standard length bounds.

## 2. The "Dirty Dozen" Hostile Payloads
We test and verify access restriction over 12 primary attack vectors:

| ID | Vulnerability/Attack Class | Target Collection | Payload Description | Expected Result |
|----|---------------------------|-------------------|---------------------|-----------------|
| D1 | Identity Spoofing         | `/rooms`          | Create room with `creatorId = "target_uid"` | PERMISSION_DENIED |
| D2 | Out-of-Turn Exploitation  | `/rooms/{roomId}` | Edit `fen` of active game when turn matches opponent | PERMISSION_DENIED |
| D3 | Spectator Overreach       | `/rooms/{roomId}` | Edit `fen` or `turn` as an un-enlisted spectator | PERMISSION_DENIED |
| D4 | Shadow Fields injection   | `/rooms/{roomId}` | Append secret `adminOverride` field in rooms | PERMISSION_DENIED |
| D5 | Score Tampering           | `/users/{userId}` | Arbitrarily increment wins to 9999 by self | PERMISSION_DENIED |
| D6 | Cross-User Profile Edit   | `/users/{userId}` | Modify another user's display name or wins | PERMISSION_DENIED |
| D7 | Terminal Overwrite        | `/rooms/{roomId}` | Submit move to a room already marked as `finished` | PERMISSION_DENIED |
| D8 | FEN String Poisoning      | `/rooms/{roomId}` | Send a 2MB giant FEN string to exhaust server memory | PERMISSION_DENIED |
| D9 | Room Code Poisoning       | `/rooms`          | Create a room where `roomId` is a giant random text | PERMISSION_DENIED |
| D10| Chat Message Spoofing    | `/rooms/{roomId}/messages` | Post chat message setting `userId = "target_uid"` | PERMISSION_DENIED |
| D11| Double-Dipping Joining   | `/rooms/{roomId}` | Forcefully overwrite active `whitePlayerId` | PERMISSION_DENIED |
| D12| Spectator Spoofing        | `/rooms/{roomId}/spectators` | Create spectator entry claiming to be another user | PERMISSION_DENIED |
