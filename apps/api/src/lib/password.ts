import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

export const hashPassword = async (password: string) => {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scrypt(password, salt, SCRYPT_KEY_LENGTH) as Buffer;
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
};

export const verifyPassword = async (password: string, passwordHash: string) => {
    const [algorithm, salt, hash] = passwordHash.split('$');
    if (algorithm !== 'scrypt' || !salt || !hash) {
        return false;
    }

    const derivedKey = await scrypt(password, salt, SCRYPT_KEY_LENGTH) as Buffer;
    const storedKey = Buffer.from(hash, 'hex');

    return derivedKey.length === storedKey.length && timingSafeEqual(derivedKey, storedKey);
};
