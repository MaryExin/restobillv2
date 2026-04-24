"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiUser, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import useApiHost from "../../hooks/useApiHost";

import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";
import ModalFailure from "../Modals/ModalFailure";
import ModalAttemp from "../Modals/ModalAttemp";

import useZustandLoginCred from "../../context/useZustandLoginCred";
import useLoginAttempts from "../../context/useLoginAttempts ";
import { useTheme } from "../../context/ThemeContext";

const FALLBACK_RIGHT_IMAGE = ".//login-visual.png";

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== "string") return null;

  let normalized = hex.replace("#", "").trim();

  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (normalized.length !== 6) return null;

  const num = parseInt(normalized, 16);
  if (Number.isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const toRgba = (hex, alpha = 1) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const getContrastText = (hex, fallback = "#ffffff") => {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;

  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 155 ? "#0f172a" : "#ffffff";
};

const readCssVar = (name, fallback = "") => {
  if (typeof window === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
};

const PosLoginComponent = () => {
  const navigate = useNavigate();
  const userInputRef = useRef(null);
  const apiHost = useApiHost();

  const { isThemeLoading, themeSettings } = useTheme();

  const {
    toggleAuthToTrue,
    toggleFirstName,
    updateUserRole,
    setUserId,
    toggleEmail,
    setProfilePic,
  } = useZustandLoginCred();

  const { attempts, incrementAttempts, resetAttempts } = useLoginAttempts();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [invalidAuth, setInvalidAuth] = useState(false);
  const [modalAttemp, setModalAttemp] = useState(false);
  const [isYesNoModalOpen, setIsYesNoModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userInputRef.current) {
      userInputRef.current.focus();
    }
  }, []);

  const accent = readCssVar("--app-accent", "#2563eb");
  const accentSecondary = readCssVar("--app-accent-secondary", "#1d4ed8");
  const bg = readCssVar("--app-bg", "#f8fafc");
  const surface = readCssVar("--app-surface", "#ffffff");
  const surfaceSoft = readCssVar("--app-surface-soft", "rgba(255,255,255,0.9)");
  const text = readCssVar("--app-text", "#0f172a");
  const mutedText = readCssVar("--app-muted-text", "rgba(15,23,42,0.68)");
  const accentGlow = readCssVar("--app-accent-glow", "rgba(37,99,235,0.35)");

  const loginBgValue = themeSettings?.Login_Background_Url || "";
  const loginBackgroundImage = !loginBgValue
    ? FALLBACK_RIGHT_IMAGE
    : loginBgValue.startsWith("/")
      ? `${apiHost}${loginBgValue}`
      : `${apiHost}/${loginBgValue}`;

  const logoValue = themeSettings?.Logo_Url || "";
  const logoUrl = !logoValue
    ? ""
    : logoValue.startsWith("/")
      ? `${apiHost}${logoValue}`
      : `${apiHost}/${logoValue}`;

  const buttonTextColor = useMemo(
    () => getContrastText(accent, "#ffffff"),
    [accent],
  );

  const isDisabled = useMemo(() => {
    return (
      !String(formData.username || "").trim() ||
      !String(formData.password || "").trim() ||
      !String(apiHost || "").trim()
    );
  }, [formData.username, formData.password, apiHost]);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const resetForm = () => {
    setFormData({ username: "", password: "" });
    setShowPassword(false);
    setIsSubmitting(false);
    navigate("/poscoreselectbusunit");
  };

  const handleOpenConfirm = (e) => {
    if (e) e.preventDefault();
    if (isDisabled || isSubmitting) return;
    setIsYesNoModalOpen(true);
  };

  const handleFailedAttempt = () => {
    const nextAttempts = attempts + 1;
    incrementAttempts();

    if (nextAttempts >= 3) {
      setModalAttemp(true);
    } else {
      setInvalidAuth(true);
    }
  };

  const handleConfirmedLogin = async () => {
    if (!apiHost) {
      setIsYesNoModalOpen(false);
      setInvalidAuth(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const loginPayload = new FormData();
      loginPayload.append("username", formData.username);
      loginPayload.append("password", formData.password);

      const response = await fetch(`${apiHost}/api/login.php`, {
        method: "POST",
        body: loginPayload,
      });

      const result = await response.json();

      setIsSubmitting(false);
      setIsYesNoModalOpen(false);

      if (result.message === "loginsuccess") {
        resetAttempts();

        const nextUserId = result.userid || "";
        const nextUsername = result.username || "";
        const nextEmail = result.email || "";
        const nextProfilePic = result.profile_pic || "";

        let nextRole = result.userrole || "";
        if (Array.isArray(nextRole)) {
          nextRole = nextRole[0] || "";
        }

        if (result.access_token) {
          localStorage.setItem("access_token", result.access_token);
        }

        if (result.refresh_token) {
          localStorage.setItem("refresh_token", result.refresh_token);
        }

        localStorage.setItem("user_id", nextUserId);
        localStorage.setItem("username", nextUsername);
        localStorage.setItem("email", nextEmail);
        localStorage.setItem(
          "user_role",
          Array.isArray(result.userrole)
            ? JSON.stringify(result.userrole)
            : nextRole,
        );
        localStorage.setItem("profile_pic", nextProfilePic);

        toggleAuthToTrue();
        toggleFirstName(nextUsername);
        updateUserRole(nextRole);
        toggleEmail(nextEmail);
        setUserId(nextUserId);
        setProfilePic(nextProfilePic);

        window.dispatchEvent(new Event("storage"));

        setIsSuccessModalOpen(true);
      } else {
        handleFailedAttempt();
      }
    } catch (error) {
      console.error("Login Error:", error);
      setIsSubmitting(false);
      setIsYesNoModalOpen(false);
      setInvalidAuth(true);
    }
  };

  // const handleInspectUsbPrinter = async () => {
  //   console.log("button clicked");

  //   try {
  //     const result = await window.electronAPI.checkEscposPrinter();
  //     console.log("Printer check result:", result);
  //     alert(JSON.stringify(result, null, 2));
  //   } catch (error) {
  //     console.error("Printer check failed:", error);
  //     alert(error?.message || "Printer check failed");
  //   }
  // };

  // const handleTestPrint = async () => {
  //   try {
  //     const result = await window.electronAPI.testEscpos();
  //     console.log("Test print result:", result);
  //     alert(JSON.stringify(result, null, 2));
  //   } catch (error) {
  //     console.error("Test print failed:", error);
  //     alert(error?.message || "Test print failed");
  //   }
  // };

  return (
    <>
      <div
        className="h-screen overflow-hidden lg:py-10"
        style={{
          background: `linear-gradient(135deg, ${bg} 0%, ${toRgba(
            accentSecondary,
            0.16,
          )} 100%)`,
        }}
      >
        <div className="mx-auto h-full w-full max-w-[1600px]">
          <div className="grid h-full grid-cols-1 md:grid-cols-[420px_minmax(0,1fr)] lg:grid-cols-[460px_minmax(0,1fr)]">
            <section
              className="relative flex h-full items-center justify-center overflow-hidden px-5 py-6 sm:px-6 md:px-8"
              style={{
                backgroundColor: surfaceSoft,
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, ${toRgba(
                    surface,
                    0.72,
                  )} 0%, ${toRgba(bg, 0.12)} 100%)`,
                  backdropFilter: "blur(4px)",
                }}
              />

              <div
                className="pointer-events-none absolute -left-12 top-10 h-40 w-40 rounded-full blur-3xl"
                style={{
                  backgroundColor: toRgba(accent, 0.18),
                }}
              />
              <div
                className="pointer-events-none absolute -bottom-12 right-0 h-48 w-48 rounded-full blur-3xl"
                style={{
                  backgroundColor: toRgba(accentSecondary, 0.18),
                }}
              />

              <div className="relative z-10 w-full max-w-[340px]">
                <div className="mb-12">
                  {logoUrl ? (
                    <div className="mb-6 flex justify-center">
                      <img
                        src={logoUrl}
                        alt="Brand logo"
                        className="max-h-[78px] w-auto object-contain"
                        onError={() => console.error("Logo failed:", logoUrl)}
                      />
                    </div>
                  ) : null}

                  <h1
                    className="text-center text-[34px] font-extrabold tracking-tight sm:text-[38px]"
                    style={{
                      color: accent,
                    }}
                  >
                    Point of Sales
                  </h1>

                  <p
                    className="mt-3 text-center text-sm font-medium"
                    style={{ color: mutedText }}
                  >
                    {isThemeLoading
                      ? "Loading theme..."
                      : "Sign in to continue"}
                  </p>
                </div>

                <form onSubmit={handleOpenConfirm} className="space-y-5">
                  <div className="relative">
                    <div
                      className="flex h-14 items-center rounded-full border px-4 shadow-[0_6px_18px_rgba(0,0,0,0.04)]"
                      style={{
                        borderColor: toRgba(accent, 0.32),
                        backgroundColor: toRgba(surface, 1),
                      }}
                    >
                      <div
                        className="mr-3 grid h-8 w-8 place-items-center rounded-full"
                        style={{
                          backgroundColor: toRgba(accent, 0.12),
                          color: accent,
                        }}
                      >
                        <FiUser className="h-4 w-4" />
                      </div>

                      <input
                        ref={userInputRef}
                        type="text"
                        value={formData.username}
                        onChange={handleChange("username")}
                        placeholder="Username"
                        className="h-full w-full border-none bg-transparent text-center text-[17px] font-medium outline-none"
                        style={{
                          color: text,
                        }}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <div
                      className="flex h-14 items-center rounded-full border px-4 shadow-[0_6px_18px_rgba(0,0,0,0.04)]"
                      style={{
                        borderColor: toRgba(accent, 0.24),
                        backgroundColor: toRgba(surface, 1),
                      }}
                    >
                      <div
                        className="mr-3 grid h-8 w-8 place-items-center rounded-full"
                        style={{
                          backgroundColor: toRgba(accent, 0.12),
                          color: accent,
                        }}
                      >
                        <FiLock className="h-4 w-4" />
                      </div>

                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleChange("password")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleConfirmedLogin();
                          }
                        }}
                        placeholder="••••••"
                        className="h-full w-full border-none bg-transparent text-center text-[17px] font-medium tracking-[0.2em] outline-none"
                        style={{
                          color: text,
                        }}
                        autoComplete="current-password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="ml-3 grid h-8 w-8 place-items-center rounded-full transition"
                        style={{
                          color: toRgba(text, 0.7),
                        }}
                      >
                        {showPassword ? (
                          <FiEyeOff className="h-4 w-4" />
                        ) : (
                          <FiEye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleConfirmedLogin}
                      disabled={isDisabled || isSubmitting}
                      className="mx-auto flex h-[52px] w-[190px] items-center justify-center rounded-full px-6 text-[18px] font-semibold shadow-[0_14px_28px_rgba(0,0,0,0.18)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        backgroundColor: accent,
                        color: buttonTextColor,
                        boxShadow: `0 14px 28px ${accentGlow}`,
                      }}
                    >
                      {!apiHost ? (
                        "Resolving..."
                      ) : isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                            style={{
                              borderColor: `${buttonTextColor} ${buttonTextColor} transparent ${buttonTextColor}`,
                            }}
                          />
                          <span>Logging in...</span>
                        </div>
                      ) : (
                        "Login"
                      )}
                    </button>
                  </div>
                </form>

                <div
                  className="mt-12 text-center text-[15px] font-semibold sm:mt-16"
                  style={{ color: toRgba(text, 0.62) }}
                >
                  Restaurant (Version: 1.0.1-1)
                </div>
              </div>
            </section>

            <section className="relative hidden h-full overflow-hidden md:block">
              <img
                src={loginBackgroundImage}
                alt="Login visual"
                className="h-full w-full object-cover"
                onError={() =>
                  console.error(
                    "Login background failed:",
                    loginBackgroundImage,
                  )
                }
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to left, transparent 0%, ${toRgba(
                    bg,
                    0.04,
                  )} 55%, ${toRgba(surface, 0.02)} 100%)`,
                }}
              />
            </section>
          </div>
        </div>
      </div>

      {invalidAuth && (
        <ModalFailure
          header="Login Error"
          message="Invalid username or password. Please try again."
          setIsModalOpen={setInvalidAuth}
          button="Accept"
        />
      )}

      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Login Confirmation"
          message={`Are you sure you want to login as ${formData.username}?`}
          setYesNoModalOpen={setIsYesNoModalOpen}
          triggerYesNoEvent={handleConfirmedLogin}
          isLoading={isSubmitting}
        />
      )}

      {isSuccessModalOpen && (
        <ModalSuccessNavToSelf
          header="Login Success"
          message="Authentication successful!"
          setIsModalOpen={setIsSuccessModalOpen}
          resetForm={resetForm}
          button="Accept"
        />
      )}

      {/* {modalAttemp && (
        <ModalAttemp
          setIsModalOpen={setModalAttemp}
          header="Maximum Attempts Reached"
          message="You have reached the maximum login attempts."
          button="Accept"
        />
      )} */}
    </>
  );
};

export default PosLoginComponent;
