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

const RIGHT_IMAGE = ".//login-visual.png";

const PosLoginComponent = () => {
  const navigate = useNavigate();
  const userInputRef = useRef(null);
  const apiHost = useApiHost();

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
    if (!navigator.onLine || !apiHost) {
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
            : nextRole
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

  return (
    <>
      <div className="h-screen overflow-hidden bg-[#f4f6f8] lg:py-10">
        <div className="mx-auto h-full w-full max-w-[1600px]">
          <div className="grid h-full grid-cols-1 md:grid-cols-[420px_minmax(0,1fr)] lg:grid-cols-[460px_minmax(0,1fr)]">
            <section className="relative flex h-full items-center justify-center overflow-hidden bg-white/80 px-5 py-6 sm:px-6 md:px-8">
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px]" />

              <div className="relative z-10 w-full max-w-[340px]">
                <div className="mb-12">
                  <h1 className="text-center text-[34px] font-extrabold tracking-tight text-teal-700 sm:text-[38px]">
                    Point of Sales
                  </h1>
                </div>

                <form onSubmit={handleOpenConfirm} className="space-y-5">
                  <div className="relative">
                    <div className="flex h-14 items-center rounded-full border border-teal-400/70 bg-white px-4 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                      <div className="mr-3 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500">
                        <FiUser className="h-4 w-4" />
                      </div>

                      <input
                        ref={userInputRef}
                        type="text"
                        value={formData.username}
                        onChange={handleChange("username")}
                        placeholder="Username"
                        className="h-full w-full border-none bg-transparent text-center text-[17px] font-medium text-slate-600 outline-none placeholder:text-slate-400"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <div className="flex h-14 items-center rounded-full border border-emerald-300/80 bg-white px-4 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                      <div className="mr-3 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500">
                        <FiLock className="h-4 w-4" />
                      </div>

                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleChange("password")}
                        placeholder="••••••"
                        className="h-full w-full border-none bg-transparent text-center text-[17px] font-medium tracking-[0.2em] text-slate-600 outline-none placeholder:text-slate-400"
                        autoComplete="current-password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="ml-3 grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
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
                      onClick={handleOpenConfirm}
                      disabled={isDisabled || isSubmitting}
                      className="mx-auto flex h-[52px] w-[190px] items-center justify-center rounded-full bg-teal-600 px-6 text-[18px] font-semibold text-gray-100 shadow-[0_14px_28px_rgba(13,148,136,0.30)] transition hover:bg-teal-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {!apiHost ? (
                        "Resolving..."
                      ) : isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Logging in...</span>
                        </div>
                      ) : (
                        "Login"
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-12 text-center text-[15px] font-semibold text-slate-500 sm:mt-16">
                  Restaurant (Version: 1.0.1-1)
                </div>
              </div>
            </section>

            <section className="relative hidden h-full overflow-hidden md:block">
              <img
                src={RIGHT_IMAGE}
                alt="Login visual"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-white/8" />
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