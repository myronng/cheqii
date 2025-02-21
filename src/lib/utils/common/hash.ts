import { PRIVATE_SERVER_KEY } from '$env/static/private';
import { PUBLIC_SERVER_KEY } from '$env/static/public';

export const TEXT_DECODER = new TextDecoder();
export const TEXT_ENCODER = new TextEncoder();

export async function signData(data: BufferSource) {
	const privateKey = await crypto.subtle.importKey(
		'pkcs8',
		stringToArrayBuffer(atob(PRIVATE_SERVER_KEY.replaceAll(/(-----.*-----|\n)/g, ''))),
		'Ed25519',
		true,
		['sign']
	);
	return TEXT_DECODER.decode(await crypto.subtle.sign('Ed25519', privateKey, data));
}

export async function verifyData(signature: BufferSource, data: BufferSource) {
	const publicKey = await crypto.subtle.importKey(
		'spki',
		stringToArrayBuffer(atob(PUBLIC_SERVER_KEY.replaceAll(/(-----.*-----|\n)/g, ''))),
		'Ed25519',
		true,
		['verify']
	);
	return await crypto.subtle.verify('Ed25519', publicKey, signature, data);
}

export function stringToArrayBuffer(string: string) {
	const buf = new ArrayBuffer(string.length);
	const bufView = new Uint8Array(buf);
	for (let i = 0, strLen = string.length; i < strLen; i++) {
		bufView[i] = string.charCodeAt(i);
	}
	return buf;
}
