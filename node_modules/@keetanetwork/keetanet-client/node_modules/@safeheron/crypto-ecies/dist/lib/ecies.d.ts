import * as BN from 'bn.js';
import { CryptoJSBytes } from "@safeheron/crypto-utils";
export declare namespace ECIES {
    /**
     * Encrypt CryptoJSBytes to cypher CryptoJSBytes.
     * @param pub. ECC Public Key
     * @param plainCryptoJSBytes.
     * @returns {Promise<CryptoJSBytes>}
     */
    function encryptCryptoJSBytes(pub: any, plainCryptoJSBytes: CryptoJSBytes): Promise<CryptoJSBytes>;
    /**
     * Encrypt CryptoJSBytes to cypher CryptoJSBytes with specified random IV.
     * @param pub. ECC Public Key
     * @param plainCryptoJSBytes.
     * @param r. BN
     * @param iv. Uint8Array
     * @returns {Promise<CryptoJSBytes>}
     */
    function encryptCryptoJSBytesWithRIV(pub: any, plainCryptoJSBytes: CryptoJSBytes, r: BN, iv: Uint8Array): Promise<CryptoJSBytes>;
    /**
     * Decrypt CryptoJSBytes to plain CryptoBytes.
     * @param priv. Private Key.
     * @param cypherCryptoJSBytes
     * @returns {CryptoJSBytes} Plain
     */
    function decryptCryptoJSBytes(priv: BN, cypherCryptoJSBytes: CryptoJSBytes): CryptoJSBytes;
    /**
     * Encrypt bytes to cypher bytes.
     * @param pub. ECC Public Key
     * @param plainBytes.
     * @returns {Promise<Uint8Array>} cypher bytes.
     */
    function encryptBytes(pub: any, plainBytes: Uint8Array): Promise<Uint8Array>;
    /**
     * Decrypt cypher bytes to plain bytes.
     * @param priv. Private Key.
     * @param cypherBytes
     * @returns {Uint8Array}
     */
    function decryptBytes(priv: BN, cypherBytes: Uint8Array): Uint8Array;
    /**
     * Encrypt a string to cypher bytes.
     * @param pub. ECC Public Key
     * @param plainStr
     * @returns {Promise<Uint8Array>}
     */
    function encryptString(pub: any, plainStr: string): Promise<Uint8Array>;
    /**
     * Decrypt bytes to plain bytes.
     * @param priv. Private Key.
     * @param cypherBytes
     * @returns {string} plain
     */
    function decryptString(priv: BN, cypherBytes: Uint8Array): string;
}
