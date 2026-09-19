package com.salary.toolkit.config;

import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * 凭证加密工具：AES-256-GCM，密文格式 base64(iv 12字节 || ciphertext)
 */
@Component
public class VaultCrypto {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final SecretKeySpec keySpec;

    public VaultCrypto(ToolkitProperties props) {
        String key = props.getVaultKey();
        if (key == null || key.isBlank()) {
            key = "salary-dev-key-change-me-1234567890";
        }
        byte[] raw = Arrays.copyOf(key.getBytes(StandardCharsets.UTF_8), 32);
        this.keySpec = new SecretKeySpec(raw, "AES");
    }

    public String encrypt(String plain) {
        if (plain == null || plain.isEmpty()) return null;
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));
            byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return "enc:" + Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new RuntimeException("加密失败", e);
        }
    }

    public String decrypt(String cipher) {
        if (cipher == null || cipher.isEmpty()) return null;
        if (cipher.startsWith("enc:")) cipher = cipher.substring(4);
        try {
            byte[] all = Base64.getDecoder().decode(cipher);
            byte[] iv = Arrays.copyOfRange(all, 0, 12);
            byte[] ct = Arrays.copyOfRange(all, 12, all.length);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));
            return new String(c.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    public static String generatePassword(int len) {
        String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        String lower = "abcdefghijkmnpqrstuvwxyz";
        String digits = "23456789";
        String special = "!@#$%^&*()-_=+";
        StringBuilder sb = new StringBuilder();
        sb.append(upper.charAt(RANDOM.nextInt(upper.length())));
        sb.append(lower.charAt(RANDOM.nextInt(lower.length())));
        sb.append(digits.charAt(RANDOM.nextInt(digits.length())));
        sb.append(special.charAt(RANDOM.nextInt(special.length())));
        String all = upper + lower + digits + special;
        for (int i = 4; i < len; i++) {
            sb.append(all.charAt(RANDOM.nextInt(all.length())));
        }
        char[] chars = sb.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = RANDOM.nextInt(i + 1);
            char t = chars[i];
            chars[i] = chars[j];
            chars[j] = t;
        }
        return new String(chars);
    }
}
