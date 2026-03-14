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

async function uploadFile(file, path) {
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type || undefined });
  const src = await getDownloadURL(ref);
  return { src, storagePath: path };
}

export async function loadPresentation() {
  const snapshot = await getDoc(presentationDocRef());
  if (!snapshot.exists()) {
    return { slides: [], audio: null };
  }

  const data = snapshot.data();
  return {
    slides: Array.isArray(data.slides) ? data.slides.map(mapSlideRecord) : [],
    audio: mapAudioRecord(data.audio),
  };
}

export async function uploadSlides(files) {
  const uploadedSlides = [];

  for (const file of files) {
    const id = `upload-${crypto.randomUUID()}`;
    const fileName = sanitizeFileName(file.name);
    const createdAt = new Date().toISOString();
    const path = `presentations/${DOCUMENT_ID}/photos/${id}-${fileName}`;
    const asset = await uploadFile(file, path);

    uploadedSlides.push({
      id,
      title: file.name.replace(/\.[^.]+$/, '') || 'Uploaded photo',
      caption: 'Uploaded photo',
      src: asset.src,
      kind: 'upload',
      fileName: file.name,
      mimeType: file.type,
      createdAt,
      storagePath: asset.storagePath,
      cueTime: null,
    });
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

export async function saveAudio(audio) {
  await setDoc(
    presentationDocRef(),
    { audio },
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
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  await updateDoc(ref, { updatedAt: new Date().toISOString() });
}
