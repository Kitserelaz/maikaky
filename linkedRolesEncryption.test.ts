import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "bun:test";
import { decryptLinkedRolesData, encryptLinkedRolesData } from "./linkedRolesEncryption.ts";

test("token encryption round-trips, uses fresh nonces, and rejects tampering and incorrect keys", () => {
    const previousKey = process.env.LINKED_ROLES_ENCRYPTION_KEY;
    process.env.LINKED_ROLES_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    try {
        const plaintext = JSON.stringify({ user: { accessToken: "private-token" } });
        const encrypted = encryptLinkedRolesData(plaintext);
        assert.equal(decryptLinkedRolesData(encrypted), plaintext);
        assert.notDeepEqual(encrypted, encryptLinkedRolesData(plaintext));
        assert.equal(encrypted.includes(Buffer.from("private-token")), false);
        const tampered = Buffer.from(encrypted);
        tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1;
        assert.throws(() => decryptLinkedRolesData(tampered));
        process.env.LINKED_ROLES_ENCRYPTION_KEY = randomBytes(32).toString("base64");
        assert.throws(() => decryptLinkedRolesData(encrypted));
    } finally {
        if (previousKey === undefined) delete process.env.LINKED_ROLES_ENCRYPTION_KEY;
        else process.env.LINKED_ROLES_ENCRYPTION_KEY = previousKey;
    }
});
