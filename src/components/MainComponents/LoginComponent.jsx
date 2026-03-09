"use client";
import React, { useEffect, useState } from "react";
import ModalSuccess from "../Modals/ModalSuccess";
import { Link, useNavigate } from "react-router-dom";
import { useMutationLogin } from "../../hooks/useMutationLogin";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ModalFailure from "../Modals/ModalFailure";
import { CircularProgress, LinearProgress } from "@mui/material";
import { useCustomMutation } from "../../hooks/useCustomMutations";
import ModalAttemp from "../Modals/ModalAttemp";
import { FiEye, FiEyeOff, FiMail, FiLock, FiShield } from "react-icons/fi";
import useLoginAttempts from "../../context/useLoginAttempts ";
import useOtpAttempts from "../../context/useOtpAttempts";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import { motion } from "framer-motion";
import { BsFillBuildingFill, BsFillBuildingsFill } from "react-icons/bs";
import ModalTrialExpiration from "../common/ModalTrial";

const LoginComponent = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const Logo = import.meta.env.VITE_LOGO;
  const navigate = useNavigate();

  // State
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [invalidAuth, setInvalidAuth] = useState(false);
  const [validAuth, setValidAuth] = useState(false);
  const [username, setUserName] = useState("");
  const [logInData, setLogInData] = useState({});
  const [modalSuccess, setModalSuccess] = useState(false);
  const [modalPasswordChangeSuccess, setModalPasswordChangeSuccess] = useState(false);
  const [modalAttemp, setModalAttemp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginDisabled, setLoginDisabled] = useState(false);
  const [resetDisabled, setResetDisabled] = useState(false);
  const [otpDisabled, setOtpDisabled] = useState(false);
  const [companyCode, setCompanyCode] = useState("");
  const [isResetMode, setIsResetMode] = useState(false); // Track if we're in reset password mode
  const [isChangePasswordMode, setIsChangePasswordMode] = useState(false); // Track if we're in change password screen
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Attempts context
  const { attempts, incrementAttempts, resetAttempts } = useLoginAttempts();
  const { otpattempts, otpincrementAttempts, otpresetAttempts } =
    useOtpAttempts();

  // Auth context
  const {
    toggleAuthToTrue,
    toggleFirstName,
    updateUserRole,
    setUserId,
    toggleEmail,
    setProfilePic,
  } = useZustandLoginCred();

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Zod schema for login (with password)
  const loginSchema = z.object({
    username: z.string().email().min(5).max(50).nonempty(),
    password: z.string().min(4).max(50).nonempty(),
  });

  // Zod schema for reset password (without password validation)
  const resetSchema = z.object({
    username: z.string().email().min(5).max(50).nonempty(),
  });

  // React Hook Form - dynamically switch schema based on mode
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ 
    resolver: zodResolver(isResetMode ? resetSchema : loginSchema) 
  });

  // Mutation: Login
  const { data, isLoading, mutate } = useMutationLogin();

  // Mutation: Max attempts
  const { mutate: mutatemaxattemp } = useCustomMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MAXATTEMP_ENDPOINT,
    "PATCH"
  );

  const {
    data: apiEndPointData,
    mutate: apiEndPointMutate,
    isLoading: apiEndPointIsLoading,
  } = useCustomSecuredMutation(import.meta.env.VITE_GET_API_ENDPOINT, "POST");

  useEffect(() => {
    if (companyCode !== "" && companyCode.length >= 3) {
      apiEndPointMutate({
        companycode: companyCode,
      });
    }
  }, [companyCode]);

  useEffect(() => {
    if (apiEndPointData && apiEndPointData.length > 0) {
      setEndPoint(apiEndPointData[0]?.api);
      localStorage.setItem("apiendpoint", apiEndPointData[0]?.api);
      if (apiEndPointData?.[0]?.isExpiry === 1) {
        setShowTrialExpired(true);
      } else {
        setShowTrialExpired(false);
      }
    }
  }, [apiEndPointData]);

  // Mutation: OTP verify
  const {
    data: otpData,
    isLoading: isLoadingOtp,
    mutate: mutateOtp,
  } = useCustomMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_VERIFY_OTP_ENDPOINT,
    "PATCH"
  );

  const {
    data: resetData,
    isLoading: isLoadingReset,
    mutate: mutateReset,
  } = useCustomMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_SETUP_RESET_OTP_MUTATION,
    "POST"
  );

  const {
    data: changePasswordData,
    isLoading: isLoadingChangePassword,
    mutate: mutateChangePassword,
  } = useCustomMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_CHANGE_PASSWORD_LOGIN_ENDPOINT,
    "PATCH"
  );

  const [otp, setOtp] = useState("");

  // Handle Login Submit
  const onLoginSubmit = handleSubmit((formData) => {
    if (!navigator.onLine) {
      alert("No internet connection. Please check your network and try again.");
      return;
    }
    if (loginDisabled) {
      alert("Please wait a moment before trying again.");
      return;
    }
    if (!apiEndPointData) {
      alert("Input your company code.");
      return;
    }
    setLoginDisabled(true);
    setTimeout(() => setLoginDisabled(false), 2000);
    mutate({ username: formData.username, password: formData.password });
    setUserName(formData.username);

    // timer resend
    setCooldown(60);
  });

  // Handle Reset Password Submit
  const onResetSubmit = handleSubmit((formData) => {
    if (!navigator.onLine) {
      alert("No internet connection. Please check your network and try again.");
      return;
    }
    if (resetDisabled) {
      alert("Please wait a moment before trying again.");
      return;
    }
    if (!apiEndPointData) {
      alert("Input your company code.");
      return;
    }
    setResetDisabled(true);
    setLoginDisabled(true);
    setTimeout(() => setLoginDisabled(false), 2000);
    setTimeout(() => setResetDisabled(false), 2000);
    mutateReset({ username: formData.username });
    setUserName(formData.username);

    // timer resend
    setCooldown(60);
  });

  // Handle OTP Submit
  const handleOTPSubmission = () => {
    if (!navigator.onLine) {
      alert("No internet connection. Please check your network and try again.");
      return;
    }
    if (otpDisabled) {
      alert("Please wait a moment before trying again.");
      return;
    }
    if (otp.length !== 6) {
      alert("Incorrect OTP");
      return;
    }
    setOtpDisabled(true);
    setTimeout(() => setOtpDisabled(false), 2000);
    mutateOtp({ username, otp });
  };

  // Handle Change Password Submit
  const handleChangePasswordSubmit = () => {
    if (!navigator.onLine) {
      alert("No internet connection. Please check your network and try again.");
      return;
    }
    
    // Validation
    if (newPassword.length < 4) {
      alert("Password must be at least 4 characters long");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    
    mutateChangePassword({ 
      username, 
      password: newPassword,
      otp 
    });
  };

  // Effects: Login responses
  useEffect(() => {
    if (data) {
      if (data.message === "loginsuccess") {
        setLogInData(data);
        setValidAuth(true);
        resetAttempts();
      } else {
        incrementAttempts();
        if (attempts >= 3) {
          mutatemaxattemp({ username, status: "Inactive" });
          setModalAttemp(true);
        }
        setInvalidAuth(true);
      }
    }
  }, [data]);

  // Effects: Reset Password responses
  useEffect(() => {
    if (resetData) {
      if (resetData.message === "OTP Sent Successfully") {
        // OTP sent successfully, show OTP input screen
        setValidAuth(true);
        setIsResetMode(true);
      } else {
        alert("Failed to send OTP. Please try again.");
      }
    }
  }, [resetData]);

  // Effects: OTP responses
  useEffect(() => {
    if (otpData) {
      if (otpData.message === "invalidOTP") {
        alert("Invalid OTP Code, please check your email");
        otpincrementAttempts();
        if (otpattempts >= 3) {
          mutatemaxattemp({ username, status: "Inactive" });
          setModalAttemp(true);
        }
      } else if (otpData.message === "User Verified") {
        otpresetAttempts();
        
        // Check if we're in reset password mode
        if (isResetMode) {
          // Show change password screen instead of navigating
          setIsChangePasswordMode(true);
          setValidAuth(false); // Hide OTP screen
        } else {
          // Normal login flow
          localStorage.setItem("access_token", logInData.access_token);
          localStorage.setItem("refresh_token", logInData.refresh_token);
          localStorage.setItem("apiendpoint", endpoint);
          localStorage.setItem("companycode", companyCode);
          localStorage.setItem("isFirstTimeLogin", logInData.isFirsTimeLogin);
          toggleAuthToTrue();
          toggleFirstName(logInData.username);
          updateUserRole(logInData.userrole);
          toggleEmail(logInData.email);
          setModalSuccess(true);
          setUserId(logInData.userid);
          setProfilePic(logInData.profile_pic);
        }
      }
    }
  }, [otpData]);

  // Effects: Change Password responses
  useEffect(() => {
    if (changePasswordData) {
      if (changePasswordData.message === "Password changed successfully") {
        setModalPasswordChangeSuccess(true);
        // Reset password-related states but keep company code
        setIsChangePasswordMode(false);
        setIsResetMode(false);
        setValidAuth(false);
        setNewPassword("");
        setConfirmPassword("");
        setOtp("");
        setUserName("");
      } else {
        alert("Failed to change password. Please try again.");
      }
    }
  }, [changePasswordData]);

  let finalRoute = "/dashboardmain";

  return (
    <div className="flex h-screen w-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black">
      {showTrialExpired && (
        <ModalTrialExpiration
          header="Your Trial Period Has Ended"
          message="Your 1-month free trial has expired. Upgrade to a paid plan to continue using all features."
          button="View Pricing Plans"
          route="/pricing-list"
          setIsModalOpen={setShowTrialExpired}
        />
      )}
      {modalPasswordChangeSuccess && (
        <ModalSuccess
          header="Password Changed Successfully"
          message="Your password has been updated. Please login with your new password."
          route="/"
          button="Accept"
        />
      )}
      {/* Left Panel - Login Form */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-slate-950 via-gray-950 to-black text-white flex items-center justify-center overflow-y-auto relative">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating geometric shapes */}
          <motion.div
            animate={{
              x: [0, 30, 0],
              y: [0, -20, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute top-20 left-20 w-16 h-16 border border-blue-500/20 rounded-lg"
          />
          <motion.div
            animate={{
              x: [0, -25, 0],
              y: [0, 15, 0],
              rotate: [0, -180, -360],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute bottom-32 right-32 w-12 h-12 bg-blue-500/10 rounded-full blur-sm"
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-1/2 left-10 w-8 h-8 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-sm"
          />
        </div>

        {/* Grid Pattern Background */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M0 0h1v1H0V0zm20 0h1v1h-1V0zm0 20h1v1h-1v-1zM0 20h1v1H0v-1z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full p-8 relative z-10"
        >
          {isChangePasswordMode ? (
            /* CHANGE PASSWORD SCREEN */
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="space-y-8 bg-gray-900/50 backdrop-blur-2xl border border-gray-700/50 p-8 rounded-2xl shadow-2xl"
              >
                {isLoadingChangePassword && (
                  <div className="mb-4">
                    <LinearProgress
                      sx={{
                        backgroundColor: "rgba(55, 65, 81, 0.3)",
                        "& .MuiLinearProgress-bar": {
                          background:
                            "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                        },
                        borderRadius: "8px",
                        height: "3px",
                      }}
                    />
                  </div>
                )}

                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl mb-4 border border-gray-700/50"
                  >
                    <FiLock className="w-8 h-8 text-blue-400" />
                  </motion.div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Create New Password
                  </h1>
                  <p className="text-gray-400">
                    Enter your new password to complete the reset
                  </p>
                  <div className="inline-flex items-center px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
                    <FiMail className="w-4 h-4 mr-2 text-blue-400" />
                    <span className="text-sm font-medium text-gray-300">
                      {username}
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="space-y-6"
                >
                  {/* New Password Field */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute z-20 inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showNewPassword ? (
                          <FiEyeOff size={20} />
                        ) : (
                          <FiEye size={20} />
                        )}
                      </button>
                    </div>
                    {newPassword.length > 0 && newPassword.length < 4 && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-400 text-sm flex items-center"
                      >
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                        Password must be at least 4 characters
                      </motion.p>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute z-20 inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showConfirmPassword ? (
                          <FiEyeOff size={20} />
                        ) : (
                          <FiEye size={20} />
                        )}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-400 text-sm flex items-center"
                      >
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                        Passwords do not match
                      </motion.p>
                    )}
                    {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length >= 4 && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-emerald-400 text-sm flex items-center"
                      >
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></span>
                        Passwords match
                      </motion.p>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleChangePasswordSubmit}
                    disabled={
                      isLoadingChangePassword || 
                      newPassword.length < 4 || 
                      newPassword !== confirmPassword
                    }
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed transition-all duration-300 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl"
                  >
                    {isLoadingChangePassword ? (
                      <div className="flex items-center justify-center">
                        <CircularProgress
                          size={20}
                          sx={{ color: "#fff", mr: 1 }}
                        />
                        <span className="ml-2">Changing Password...</span>
                      </div>
                    ) : (
                      "Change Password"
                    )}
                  </motion.button>
                </form>

                <div className="text-center">
                  <button
                    onClick={() => {
                      setIsChangePasswordMode(false);
                      setIsResetMode(false);
                      setValidAuth(false);
                      setNewPassword("");
                      setConfirmPassword("");
                      setOtp("");
                    }}
                    className="text-gray-400 text-sm hover:text-blue-400 transition-colors"
                  >
                    Back to Login
                  </button>
                </div>
              </motion.div>
            </>
          ) : validAuth ? (
            /* OTP SCREEN */
            <>
              {modalSuccess && !isResetMode && (
                <ModalSuccess
                  header="Login successful"
                  message="Signed in successfully"
                  route={finalRoute}
                  button="Accept"
                />
              )}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="space-y-8 bg-gray-900/50 backdrop-blur-2xl border border-gray-700/50 p-8 rounded-2xl shadow-2xl"
              >
                {isLoadingOtp && (
                  <div className="mb-4">
                    <LinearProgress
                      sx={{
                        backgroundColor: "rgba(55, 65, 81, 0.3)",
                        "& .MuiLinearProgress-bar": {
                          background:
                            "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                        },
                        borderRadius: "8px",
                        height: "3px",
                      }}
                    />
                  </div>
                )}

                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl mb-4 border border-gray-700/50"
                  >
                    <FiShield className="w-8 h-8 text-blue-400" />
                  </motion.div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {isResetMode ? "Reset Password Verification" : "Verify Your Identity"}
                  </h1>
                  <p className="text-gray-400">
                    We've sent a verification code to
                  </p>
                  <div className="inline-flex items-center px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
                    <FiMail className="w-4 h-4 mr-2 text-blue-400" />
                    <span className="text-sm font-medium text-gray-300">
                      {username}
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Verification Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200 placeholder-gray-500"
                        placeholder="000000"
                        onChange={(e) => setOtp(e.target.value)}
                      />
                    </div>
                    {otp.length !== 6 && otp.length > 0 && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-400 text-sm flex items-center"
                      >
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                        OTP must be 6 digits
                      </motion.p>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOTPSubmission}
                    disabled={isLoadingOtp || otpDisabled || otp.length !== 6}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed transition-all duration-300 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl"
                  >
                    {isLoadingOtp ? (
                      <div className="flex items-center justify-center">
                        <CircularProgress
                          size={20}
                          sx={{ color: "#fff", mr: 1 }}
                        />
                        <span className="ml-2">Verifying...</span>
                      </div>
                    ) : (
                      "Verify Code"
                    )}
                  </motion.button>
                </form>

                <div className="text-center">
                  <p className="text-gray-400 text-sm">
                    Didn't receive the code?{" "}
                    <button
                      onClick={isResetMode ? onResetSubmit : onLoginSubmit}
                      disabled={cooldown > 0}
                      className={`font-medium underline decoration-dotted underline-offset-2 transition-colors
            ${
              cooldown > 0
                ? "text-gray-400 cursor-not-allowed"
                : "text-blue-400 hover:text-blue-300"
            }`}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
                    </button>
                  </p>
                </div>
              </motion.div>
            </>
          ) : (
            /* LOGIN FORM */
            <>
              {invalidAuth && (
                <ModalFailure
                  header="Authentication Failed!"
                  message="Try to login again..."
                  button="Accept"
                  setIsModalOpen={setInvalidAuth}
                />
              )}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="space-y-8"
              >
                {/* Logo Section */}
                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="inline-flex items-center justify-center w-20 h-20 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 mb-6"
                  >
                    <img
                      src={
                        Logo ||
                        "/placeholder.svg?height=48&width=48&query=company logo"
                      }
                      alt="Logo"
                      className="w-12 h-12 object-contain"
                    />
                  </motion.div>
                  <div>
                    <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-white via-gray-200 to-gray-300 bg-clip-text text-transparent">
                      Welcome Back
                    </h1>
                    <p className="text-gray-400">
                      Sign in to your account to continue
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="space-y-6"
                >
                  {/* Company Code Field */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="space-y-2"
                  >
                    <label className="block text-sm font-medium text-gray-300">
                      Company Code
                    </label>
                    <div className="relative">
                      <div className="absolute z-20 inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <BsFillBuildingsFill className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        type="text"
                        placeholder="Enter your company code"
                        value={companyCode}
                        onChange={(e) => setCompanyCode(e.target.value)}
                        className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                    {apiEndPointData &&
                      apiEndPointData.length > 0 &&
                      (apiEndPointData?.[0]?.isExpiry === 0 ? (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-emerald-400 text-sm flex items-center"
                        >
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></span>
                          Company verified successfully
                        </motion.p>
                      ) : (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-yellow-400 text-sm flex items-center"
                        >
                          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-2"></span>
                          Company verified successfully, but the plan has
                          expired.
                        </motion.p>
                      ))}
                    {companyCode !== "" &&
                      apiEndPointData &&
                      apiEndPointData.length === 0 && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-red-400 text-sm flex items-center"
                        >
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                          Company not found.
                        </motion.p>
                      )}
                    {apiEndPointIsLoading && (
                      <div className="flex items-center justify-center mt-3">
                        <CircularProgress size={16} sx={{ color: "#3b82f6" }} />
                        <span className="ml-2 text-sm text-gray-400">
                          Verifying...
                        </span>
                      </div>
                    )}
                  </motion.div>

                  {/* Email Field */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="space-y-2"
                  >
                    <label className="block text-sm font-medium text-gray-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute z-20 inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiMail className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        {...register("username")}
                        placeholder="you@company.com"
                        className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200"
                      />
                    </div>
                    {errors.username && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-400 text-sm flex items-center"
                      >
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                        {errors.username.message}
                      </motion.p>
                    )}
                  </motion.div>

                  {/* Password Field - Only show in login mode */}
                  {!isResetMode && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="space-y-2"
                    >
                      <label className="block text-sm font-medium text-gray-300">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute  z-20 inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiLock className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          {...register("password")}
                          placeholder="Enter your password"
                          className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showPassword ? (
                            <FiEyeOff size={20} />
                          ) : (
                            <FiEye size={20} />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-red-400 text-sm flex items-center"
                        >
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                          {errors.password.message}
                        </motion.p>
                      )}
                    </motion.div>
                  )}

                  {/* Login Button - Only show in login mode */}
                  {apiEndPointData && apiEndPointData?.[0]?.isExpiry === 0 && !isResetMode && (
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onLoginSubmit}
                      disabled={isLoading || loginDisabled}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed transition-all duration-300 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <CircularProgress size={20} sx={{ color: "#fff" }} />
                          <span className="ml-2">Signing in...</span>
                        </div>
                      ) : (
                        "Sign In"
                      )}
                    </motion.button>
                  )}
                  
                  {/* Reset Button */}
                  {apiEndPointData && apiEndPointData?.[0]?.isExpiry === 0 && (
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (isResetMode) {
                          // If already in reset mode, send OTP
                          onResetSubmit();
                        } else {
                          // Switch to reset mode
                          setIsResetMode(true);
                        }
                      }}
                      disabled={isLoadingReset || resetDisabled}
                      className={
                        isResetMode
                          ? `w-full bg-gradient-to-r from-cyan-500 to-blue-600
                             hover:from-cyan-600 hover:to-blue-700
                             disabled:from-gray-700 disabled:to-gray-800
                             disabled:cursor-not-allowed transition-all duration-300
                             py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl`
                          : "w-full"
                      }
                    >
                      {isLoadingReset ? (
                        <div className="flex items-center justify-center">
                          <CircularProgress size={20} sx={{ color: "#fff" }} />
                          <span className="ml-2">Sending OTP...</span>
                        </div>
                      ) : (
                        isResetMode ? "Send Reset OTP" : "Reset Password"
                      )}
                    </motion.button>
                  )}


                  {/* Back to Login button - Only show in reset mode */}
                  {isResetMode && (
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsResetMode(false)}
                      className="w-full bg-transparent border border-gray-600 hover:border-gray-500 transition-all duration-300 py-3 rounded-xl text-gray-300 font-semibold"
                    >
                      Back to Login
                    </motion.button>
                  )}
                </form>
              </motion.div>
            </>
          )}
          {modalAttemp && (
            <ModalAttemp
              header="You have reached the maximum login/otp attempts."
              message="Your account has been locked. Please contact your administrator."
              route="/"
              button="Accept"
            />
          )}
        </motion.div>
      </div>

      {/* Right Panel - Dark Mode Branding */}
      <div className="hidden md:flex w-1/2 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          {/* Floating geometric shapes */}
          <motion.div
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
              rotate: [0, 360],
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute top-20 right-20 w-20 h-20 border-2 border-blue-400/20 rounded-2xl"
          />
          <motion.div
            animate={{
              x: [0, -40, 0],
              y: [0, 25, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-40 left-20 w-16 h-16 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-sm"
          />
          <motion.div
            animate={{
              rotate: [0, 180, 360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute top-1/3 right-1/4 w-12 h-12 border border-indigo-400/30 rounded-lg"
          />
        </div>

        {/* Subtle Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%234f46e5'%3E%3Cpath d='M0 0h1v1H0V0zm30 0h1v1h-1V0zm0 30h1v1h-1v-1zM0 30h1v1H0v-1z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="m-auto text-white max-w-lg p-8 space-y-8 relative"
        >
          <div className="space-y-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="inline-flex items-center space-x-3"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <h2 className="text-3xl font-bold">
                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Lightem
                </span>
              </h2>
            </motion.div>

            <div className="space-y-4">
              <h3 className="text-3xl font-bold text-white leading-tight">
                Enlightening the Future of{" "}
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Business Automation
                </span>
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                Transform your business operations with our cutting-edge
                automation platform. Streamline workflows, boost productivity,
                and drive sustainable growth.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex items-center space-x-4"
            >
              <a
                href="/"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-medium shadow-lg hover:shadow-xl"
              >
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </a>
            </motion.div>
          </div>

          {/* Enhanced Feature Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="grid grid-cols-2 gap-6 pt-8 border-t border-gray-700"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <BsFillBuildingFill className="w-5 h-5 text-indigo-400" />
              </div>
              <h4 className="font-semibold text-gray-200">Scalable Platform</h4>
              <p className="text-sm text-gray-400">
                Grows seamlessly with your business
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Decorative Element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="absolute bottom-8 right-8"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm border border-blue-400/30 rounded-xl flex items-center justify-center hover:from-blue-500/30 hover:to-indigo-500/30 transition-all duration-300 cursor-pointer group">
            <svg
              className="w-5 h-5 text-blue-400 group-hover:translate-x-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginComponent;