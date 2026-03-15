import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { firestore, storage } from './firebaseClient';
import { buildMediaItem } from './visualMedia';
import { buildAudioClipRecord } from './audioComposition';

const COLLECTION = 'presentations';
const DOCUMENT_ID = 'yan-story-teller-default';

function presentationDocRef() {
  return doc(firestore, COLLECTION, DOCUMENT_ID);
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function mapSlideRecord(record) {
  return {
    id: record.id,
    title: record.title,
    caption: record.caption,
    src: record.src,
    kind: 'upload',
    mediaType: record.mediaType || 'image',
    durationSeconds: Number.isFinite(record.durationSeconds) ? record.durationSeconds : null,
    posterSrc: record.posterSrc || '',
    fileName: record.fileName,
    mimeType: record.mimeType,
    createdAt: record.createdAt,
    storagePath: record.storagePath,
    cueTime: Number.isFinite(record.cueTime) ? record.cueTime : null,
  };
}

function mapAudioRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    title: record.title,
    fileName: record.fileName,
    mimeType: record.mimeType,
    createdAt: record.createdAt,
    kind: 'upload',
    src: record.src,
    storagePath: record.storagePath,
  };
}

function mapAudioClipRecord(record) {
  return {
    id: record.id,
    title: record.title,
    fileName: record.fileName,
    mimeType: record.mimeType,
    createdAt: record.createdAt,
    kind: 'upload',
    src: record.src,
    storagePath: record.storagePath,
    storageMode: record.storageMode || 'remote',
    durationSeconds: Number.isFinite(record.durationSeconds) ? record.durationSeconds : null,
    desiredStartTime: Number.isFinite(record.desiredStartTime) ? record.desiredStartTime : null,
  };
}

async function uploadFile(file, path) {
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type || undefined });
  const src = await getDownloadURL(ref);
  return { src, storagePath: path };
}

export async function loadPresentation() {
  const snapshot = await getDoc(presentationDocRef());
  if (!snapshot.exists()) {
    return { slides: [], audio: null, audioClips: [], audioTimeline: [], targetDurationSeconds: null };
  }

  const data = snapshot.data();
  return {
    slides: Array.isArray(data.slides) ? data.slides.map(mapSlideRecord) : [],
    audio: mapAudioRecord(data.audio),
    audioClips: Array.isArray(data.audioClips) ? data.audioClips.map(mapAudioClipRecord) : [],
    audioTimeline: Array.isArray(data.audioTimeline) ? data.audioTimeline.map((clip) => ({
      ...clip,
      durationSeconds: Number.isFinite(clip.durationSeconds) ? clip.durationSeconds : null,
      startTime: Number.isFinite(clip.startTime) ? clip.startTime : null,
      endTime: Number.isFinite(clip.endTime) ? clip.endTime : null,
      spanSeconds: Number.isFinite(clip.spanSeconds) ? clip.spanSeconds : null,
    })) : [],
    targetDurationSeconds: Number.isFinite(data.targetDurationSeconds) ? data.targetDurationSeconds : null,
  };
}

export async function uploadSlides(filesWithMetadata) {
  const uploadedSlides = [];

  for (const { file, metadata } of filesWithMetadata) {
    const id = `upload-${crypto.randomUUID()}`;
    const fileName = sanitizeFileName(file.name);
    const createdAt = new Date().toISOString();
    const folder = metadata.mediaType === 'video' ? 'videos' : 'photos';
    const path = `presentations/${DOCUMENT_ID}/${folder}/${id}-${fileName}`;
    const asset = await uploadFile(file, path);

    uploadedSlides.push(buildMediaItem({
      id,
      file,
      src: asset.src,
      storagePath: asset.storagePath,
      storageMode: 'remote',
      mediaType: metadata.mediaType,
      durationSeconds: metadata.durationSeconds,
      posterSrc: metadata.posterSrc,
      createdAt,
    }));
  }

  return uploadedSlides;
}

export async function saveSlides(slides) {
  await setDoc(
    presentationDocRef(),
    { slides },
    { merge: true },
  );
}

export async function removeSlideAsset(slide) {
  if (!slide?.storagePath) return;
  await deleteObject(storageRef(storage, slide.storagePath));
}

export async function uploadAudio(file) {
  const fileName = sanitizeFileName(file.name);
  const createdAt = new Date().toISOString();
  const path = `presentations/${DOCUMENT_ID}/audio/${Date.now()}-${fileName}`;
  const asset = await uploadFile(file, path);

  return {
    id: 'presentation-audio',
    title: file.name.replace(/\.[^.]+$/, '') || 'Uploaded audio',
    fileName: file.name,
    mimeType: file.type,
    createdAt,
    kind: 'upload',
    src: asset.src,
    storagePath: asset.storagePath,
  };
}

export async function uploadAudioClips(filesWithMetadata) {
  const uploadedClips = [];

  for (const { file, metadata } of filesWithMetadata) {
    const id = `audio-clip-${crypto.randomUUID()}`;
    const fileName = sanitizeFileName(file.name);
    const createdAt = new Date().toISOString();
    const path = `presentations/${DOCUMENT_ID}/audio-clips/${id}-${fileName}`;
    const asset = await uploadFile(file, path);

    uploadedClips.push(buildAudioClipRecord({
      id,
      file,
      src: asset.src,
      storagePath: asset.storagePath,
      storageMode: 'remote',
      durationSeconds: metadata.durationSeconds,
      createdAt,
    }));
  }

  return uploadedClips;
}

export async function saveAudio(audio) {
  await setDoc(
    presentationDocRef(),
    { audio },
    { merge: true },
  );
}

export async function saveAudioLane({ targetDurationSeconds, audioClips, audioTimeline }) {
  await setDoc(
    presentationDocRef(),
    {
      audio: null,
      targetDurationSeconds: Number.isFinite(targetDurationSeconds) ? targetDurationSeconds : null,
      audioClips,
      audioTimeline,
    },
    { merge: true },
  );
}

export async function removeAudioAsset(audio) {
  if (!audio?.storagePath) return;
  await deleteObject(storageRef(storage, audio.storagePath));
}

export async function ensurePresentationDocument() {
  const ref = presentationDocRef();
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    await setDoc(ref, {
      slides: [],
      audio: null,
      audioClips: [],
      audioTimeline: [],
      targetDurationSeconds: null,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  await updateDoc(ref, { updatedAt: new Date().toISOString() });
}
