import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import FormData from 'form-data';

const MEDIA_DIR = path.join(process.cwd(), 'data', 'media');

function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

function extensionFromMime(mimeType: string | undefined): string {
  if (!mimeType) {
    return 'bin';
  }

  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';

  const slashIndex = mimeType.lastIndexOf('/');
  if (slashIndex !== -1 && slashIndex < mimeType.length - 1) {
    return mimeType.substring(slashIndex + 1);
  }

  return 'bin';
}

export interface DownloadedMedia {
  filePath: string;
  mimeType: string;
  sha256: Buffer;
}

export interface IpfsUploadResult {
  cid: string;
  gatewayUrl: string;
}

export async function downloadMedia(mediaId: string): Promise<DownloadedMedia> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is required to download media.');
  }

  ensureMediaDir();

  const metadataResponse = await axios.get(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    {
      params: { access_token: accessToken },
    }
  );

  const { url, mime_type: mimeType } = metadataResponse.data;
  if (!url) {
    throw new Error(`Media ${mediaId} metadata response missing download URL`);
  }

  const mediaResponse = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const buffer = Buffer.from(mediaResponse.data);
  const sha256 = createHash('sha256').update(buffer).digest();

  const extension = extensionFromMime(mimeType);
  const filePath = path.join(MEDIA_DIR, `${mediaId}.${extension}`);
  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    mimeType: mimeType || 'application/octet-stream',
    sha256,
  };
}

export function deleteLocalMedia(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`⚠️ Failed to delete media file ${filePath}:`, error);
  }
}

function getPinataAuthHeaders(): Record<string, string> | null {
  const pinataJwt = process.env.PINATA_JWT;
  const apiKey = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET_API_KEY;

  if (pinataJwt) {
    return {
      Authorization: `Bearer ${pinataJwt}`,
    };
  }

  if (apiKey && secret) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secret,
    };
  }

  return null;
}

export async function uploadMediaToIpfs(downloaded: DownloadedMedia): Promise<IpfsUploadResult | null> {
  const authHeaders = getPinataAuthHeaders();

  if (!authHeaders) {
    console.warn('⚠️ Pinata credentials not configured. Skipping IPFS upload.');
    return null;
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(downloaded.filePath), {
    filename: path.basename(downloaded.filePath),
    contentType: downloaded.mimeType,
  });

  form.append(
    'pinataMetadata',
    JSON.stringify({
      name: `whatsapp-nft-${Date.now()}`,
      keyvalues: {
        source: 'whatsapp-bot',
      },
    })
  );

  form.append(
    'pinataOptions',
    JSON.stringify({
      cidVersion: 1,
    })
  );

  try {
    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
      headers: {
        ...form.getHeaders(),
        ...authHeaders,
      },
      maxBodyLength: Infinity,
    });

    const cid: string | undefined = response.data?.IpfsHash;

    if (!cid) {
      console.warn('⚠️ Pinata upload succeeded but no CID returned.');
      return null;
    }

    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;

    // Note: IPFS content may take a few seconds to propagate, so we don't verify immediately
    // The CID is valid if Pinata returned it, and the content will be available shortly
    console.log(`✅ Image uploaded to IPFS: ${gatewayUrl}`);

    return {
      cid,
      gatewayUrl,
    };
  } catch (error: any) {
    const message = error?.response?.data || error?.message || 'Unknown error';
    console.error('❌ Failed to upload media to Pinata:', message);
    return null;
  } finally {
    deleteLocalMedia(downloaded.filePath);
  }
}


