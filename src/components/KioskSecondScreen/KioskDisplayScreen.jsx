import React, { useEffect, useState, useMemo } from "react";
import useApiHost from "../../hooks/useApiHost";

const KioskDisplayScreen = () => {
  const apiHost = useApiHost();
  const [error, setError] = useState(false);
  const [imageBust, setImageBust] = useState(() => new Date().getTime());

  const imageUrl = useMemo(() => {
    try {
      const origin = apiHost ? new URL(apiHost).origin : "http://localhost";
      return `${origin}/pos_second_screen/display.jpg?t=${imageBust}`;
    } catch {
      return `http://localhost/pos_second_screen/display.jpg?t=${imageBust}`;
    }
  }, [apiHost, imageBust]);

  useEffect(() => {
    const refreshImage = () => {
      setImageBust(new Date().getTime());
      setError(false);
    };
    const handleStorage = (event) => {
      if (
        event.key === "pos-second-screen-image-bust" ||
        event.key === "pos-layout-mode-bust"
      ) {
        refreshImage();
      }
    };

    window.addEventListener("pos-second-screen-image-updated", refreshImage);
    window.addEventListener("pos-layout-mode-changed", refreshImage);
    window.addEventListener("storage", handleStorage);

    let channel = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("pos-second-screen");
      channel.onmessage = (event) => {
        if (
          event?.data?.type === "display-image-updated" ||
          event?.data?.type === "layout-mode-changed"
        ) {
          refreshImage();
        }
      };
    }

    return () => {
      window.removeEventListener("pos-second-screen-image-updated", refreshImage);
      window.removeEventListener("pos-layout-mode-changed", refreshImage);
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {!error ? (
        <img
          key={imageUrl}
          src={imageUrl}
          alt=""
          draggable={false}
          className="w-full h-full object-cover select-none"
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-white/20 text-2xl tracking-widest uppercase select-none">
            Place display.jpg in htdocs/pos_second_screen
          </p>
        </div>
      )}
    </div>
  );
};

export default KioskDisplayScreen;
