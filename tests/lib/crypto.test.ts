import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto", () => {
  it("encrypts and decrypts a string", () => {
    const plaintext = "Uživatel trpí úzkostí z práce";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same input (random IV)", () => {
    const plaintext = "test";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("encrypted format is iv:authTag:ciphertext", () => {
    const encrypted = encrypt("hello");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(32); // 16 bytes hex
    expect(parts[1]).toHaveLength(32); // 16 bytes auth tag hex
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode and special characters", () => {
    const text = "Příliš žluťoučký kůň úpěl ďábelské ódy 🇨🇿";
    expect(decrypt(encrypt(text))).toBe(text);
  });

  it("handles large text", () => {
    const text = "a".repeat(10000);
    expect(decrypt(encrypt(text))).toBe(text);
  });

  it("throws on invalid encrypted data", () => {
    expect(() => decrypt("invalid")).toThrow("Invalid encrypted data format");
    expect(() => decrypt("a:b")).toThrow("Invalid encrypted data format");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    parts[2] = "0".repeat(parts[2].length);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});
