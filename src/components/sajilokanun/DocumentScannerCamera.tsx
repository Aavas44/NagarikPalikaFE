"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./DocumentScannerCamera.module.css";

export type DocumentScannerCameraLabels = {
  openCamera: string;
  closeCamera: string;
  capture: string;
  capturing: string;
  switchCamera: string;
  cameraUnsupported: string;
  cameraPermissionDenied: string;
  cameraError: string;
  cameraHint: string;
};

type DocumentScannerCameraProps = {
  labels: DocumentScannerCameraLabels;
  disabled?: boolean;
  maxFiles?: number;
  currentFileCount: number;
  onCapture: (file: File) => void;
};

function isSecureCameraContext(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

export function DocumentScannerCamera({
  labels,
  disabled = false,
  maxFiles = 8,
  currentFileCount,
  onCapture,
}: DocumentScannerCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (facing: "environment" | "user") => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(labels.cameraUnsupported);
        return;
      }
      if (!isSecureCameraContext()) {
        setError(labels.cameraUnsupported);
        return;
      }

      setStarting(true);
      setError("");
      stopCamera();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* autoplay policies — play() may reject until gesture; stream is live */
          });
        }

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setHasMultipleCameras(
            devices.filter((device) => device.kind === "videoinput").length > 1
          );
        } catch {
          setHasMultipleCameras(false);
        }
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError(labels.cameraPermissionDenied);
        } else {
          setError(
            err instanceof Error && err.message
              ? err.message
              : labels.cameraError
          );
        }
        stopCamera();
      } finally {
        setStarting(false);
      }
    },
    [labels, stopCamera]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    void startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [open, facingMode, startCamera, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function handleCapture() {
    if (capturing || currentFileCount >= maxFiles) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(labels.cameraError);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error(labels.cameraError);

      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const file = new File([blob], `scan-${stamp}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      onCapture(file);
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : labels.cameraError
      );
    } finally {
      setCapturing(false);
    }
  }

  function handleOpen() {
    setError("");
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setError("");
  }

  function handleSwitchCamera() {
    setFacingMode((current) =>
      current === "environment" ? "user" : "environment"
    );
  }

  const atLimit = currentFileCount >= maxFiles;

  return (
    <div className={styles.root}>
      {!open ? (
        <button
          type="button"
          className={styles.openBtn}
          onClick={handleOpen}
          disabled={disabled || atLimit}
        >
          {labels.openCamera}
        </button>
      ) : (
        <div className={styles.panel}>
          <p className={styles.hint}>{labels.cameraHint}</p>
          <div className={styles.videoWrap}>
            <video
              ref={videoRef}
              className={styles.video}
              playsInline
              muted
              autoPlay
            />
            {starting ? (
              <div className={styles.videoOverlay}>Starting camera…</div>
            ) : null}
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.captureBtn}
              onClick={() => void handleCapture()}
              disabled={
                disabled || capturing || starting || Boolean(error) || atLimit
              }
            >
              {capturing ? labels.capturing : labels.capture}
            </button>
            {hasMultipleCameras ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleSwitchCamera}
                disabled={disabled || starting || capturing}
              >
                {labels.switchCamera}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleClose}
              disabled={capturing}
            >
              {labels.closeCamera}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
