import React, { useEffect } from "react";
import { useState } from "react";
import ModalSuccess from "../Modals/ModalSuccess";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutationReg } from "../../hooks/useMutationReg";
import { Avatar } from "@mui/material";
import "../../fonts/font-style.css";
import { Link } from "react-router-dom";
import { useCustomMutation } from "../../hooks/useCustomMutations";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const RegistrationComponent = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const Logo = localStorage.getItem("apiendpoint") + import.meta.env.VITE_LOGO;

  const [isAuhtenticated, setIsAuthenticated] = useState(false);
  const [username, setUserName] = useState("");
  const [otp, setOtp] = useState(0);
  const [modalSuccess, setModalSuccess] = useState(false);
  const [modalYesNo, setModalYesNo] = useState(false);

  const {
    data: mutationData,
    isLoading,
    isError,
    isSuccess,
    mutate,
  } = useCustomMutation(
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_USERREG_ENDPOINT,
    "POST"
  );

  const {
    data: otpData,
    isLoading: isLoadingOtp,
    isError: isErrorOtp,
    isSuccess: isSuccessOtp,
    mutate: mutateOtp,
  } = useCustomMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_VERIFY_OTP_ENDPOINT,
    "PATCH"
  );

  //Hook for zod schema

  const schema = z.object({
    username: z.string().email().min(5).max(50).nonempty(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .refine(
        (value) => /[A-Z]/.test(value),
        "Password must contain at least one capital letter"
      )
      .refine(
        (value) => /[\W_]/.test(value),
        "Password must contain at least one special character"
      ),
    firstname: z.string().min(3).max(20).nonempty(),
    middlename: z.string().min(1).max(20).optional(),
    lastname: z.string().min(3).max(20).nonempty(),
    company: z.string().min(3).max(20).nonempty(),
    department: z.string().min(5).max(20).nonempty(),
    contactnumber: z.string().min(11).max(11).nonempty(),
  });

  //Hook for form submission

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const handleOTPSubmission = () => {
    if (otp.length != 6) {
      Alert("Incorrect otp");
    } else {
      mutateOtp({
        username: username,
        otp: otp,
      });
    }
  };

  useEffect(() => {
    if (otpData) {
      if (otpData.message === "invalidOTP") {
        alert("Invalid OTP Code, please check your email");
      } else if (otpData.message === "User Verified") {
        setModalSuccess(true);
      }
    }
  }, [otpData]);

  const handleFormSubmit = (data) => {
    mutate({
      username: data.username,
      password: data.password,
      firstname: data.firstname,
      middlename: data.middlename,
      lastname: data.lastname,
      company: data.company,
      department: data.department,
      contactnumber: data.contactnumber,
    });
    setUserName(data.username);
  };

  return (
    <>
      {mutationData && mutationData.message === "registrationSuccessful" ? (
        <div className="z-10 flex flex-col h-screen overflow-y-hidden overflow-x-hidden justify-center p-5">
          {modalSuccess && (
            <ModalSuccess
              header={"Registration successful"}
              message="Sign up successfull"
              route={"/login"}
              button={"Accept"}
            />
          )}
          <div className="flex flex-col -mt-24 justify-start space-y-5 items-center rounded-lg h-3/6 shadow-lg w-full  bg-white p-2">
            <h1 className="p-5">
              Submit the OTP code that was sent to your email:{" "}
              <span className="bg-darkPrimary px-2 py-1 rounded-md text-white">
                {username}
              </span>
            </h1>
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="registration relative z-0 w-full mt-8">
                <input
                  type="number"
                  onWheel={(e) => e.target.blur()}
                  name="otp"
                  placeholder=""
                  autoComplete="off"
                  className="text-colorTextSecondary pt-3 pb-2 border rounded-md px-5 block w-full  mt-0 focus:outline-none"
                  onChange={(e) => setOtp(e.target.value)}
                />
                <label
                  htmlFor="otp"
                  className="registration absolute duration-300 top-4  px-3 z-1 origin-0 text-gray-500"
                >
                  OTP
                </label>

                {otp.length != 6 && (
                  <span className="text-zinc-400 text-sm">
                    OTP should not be less or more than 6 digits
                  </span>
                )}
              </div>
              <button
                onClick={handleOTPSubmission}
                className="py-5 text-center w-full rounded-sm shadow-lg shadow-green-300 text-colorTextTertiary bg-colorBrand mt-10 mb-5 text-sm text-softDark font-semibold hover:opacity-80 hover:scale-95 duration-300"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="z-10 flex flex-col h-auto overflow-y-hidden overflow-x-hidden justify-start p-5">
          {modalYesNo && (
            <ModalYesNoReusable
              header={"Confirmation"}
              message="Do you want to continue?"
              setYesNoModalOpen={setModalYesNo}
              triggerYesNoEvent={handleSubmit(handleFormSubmit)}
            />
          )}
          <div className="flex flex-col bg-white relative items-center border border-zinc-100 shadow-lg  p-10 rounded-lg space-y-7">
            {/* Sign In and Sign Up Tab */}
            <div
              style={{ fontFamily: "Raleway-Semibold" }}
              className="absolute top-0 left-0 rounded-t-md flex flex-row w-full items-center justify-center bg-colorBrand py-2 px-10"
            ></div>
            <div className="flex flex-col justify-center">
              <Avatar
                sx={{
                  width: 75,
                  height: 75,
                  border: 2,
                  boxShadow: 3,
                }}
                className="mt-5 animate-bounce_light"
              >
                <img src={Logo} alt="Avatar" />
              </Avatar>
              <div className="h-[9px] rounded-full w-12 self-center shadow-lg shadow-zinc-800"></div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setModalYesNo(true);
              }}
            >
              <h1
                style={{ fontFamily: "Raleway-Semibold" }}
                className="text-2xl text-colorTextSecondary mb-7 text-center"
              >
                Welcome to{" "}
                <span className="text-darkPrimary">Don Benito's</span>
              </h1>
              {/* Two Columns Input Boxes */}
              <div className="flex flex-col relative lg:flex-row lg:space-x-3 justify-center">
                {/* Input Box for username */}
                <div className="flex lg:w-1/2 lg:flex-row mb-10 justify-start items-center px-3 border border-colorBoxSecondary rounded-md">
                  <div className="registration relative z-0 w-full">
                    <input
                      type="text"
                      name="username"
                      placeholder=" "
                      autoComplete="off"
                      className="text-colorTextSecondary pt-3 pb-2 px-5 block w-full  mt-0  bg-transparent focus:outline-none"
                      {...register("username")}
                    />
                    <label
                      htmlFor="username"
                      className="registration absolute duration-300 top-4 -z-1 origin-0 text-gray-500"
                    >
                      Email <span className="text-xs">(as username)</span>
                    </label>
                  </div>
                </div>

                {errors.username && (
                  <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-left-2 lg:w-1/2 relative  bottom-8">
                    {errors.username.message}
                  </span>
                )}

                {/* Input Box for password */}

                <div className="flex flex-row lg:w-1/2 mb-10 justify-start items-center space-x-2 px-3 border border-colorBoxSecondary rounded-md">
                  <div className="registration relative z-0 w-full">
                    <input
                      type="password"
                      name="password"
                      placeholder=" "
                      autoComplete="off"
                      className="text-colorTextSecondary pt-3 pb-2 px-5 block w-full  mt-0  bg-transparent focus:outline-none"
                      {...register("password")}
                    />
                    <label
                      htmlFor="password"
                      className="registration absolute duration-300 top-4 -z-1 origin-0 text-gray-500"
                    >
                      Password{" "}
                      <span className="text-xs">(not your email password)</span>
                    </label>
                  </div>
                </div>

                {errors.password && (
                  <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-right-2 lg:w-1/2 relative  bottom-8">
                    {errors.password.message}
                  </span>
                )}
              </div>

              {/* Two Columns Input Boxes */}
              <div className="flex flex-col relative lg:flex-row lg:space-x-3 justify-center">
                {/* Input Box for Firstname */}
                <div className="flex lg:w-1/2 lg:flex-row mb-7 justify-start items-center px-3 border border-colorBoxSecondary rounded-md">
                  <div className="registration relative z-0 w-full">
                    <input
                      type="text"
                      name="firstname"
                      placeholder=" "
                      autoComplete="off"
                      className="text-colorTextSecondary pt-3 pb-2 px-5 block w-full  mt-0  bg-transparent focus:outline-none"
                      {...register("firstname")}
                    />
                    <label
                      htmlFor="firstname"
                      className="registration absolute duration-300 top-4 -z-1 origin-0 text-gray-500"
                    >
                      First name
                    </label>
                  </div>
                </div>

                {errors.firstname && (
                  <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-left-2 lg:w-1/2 relative  bottom-8">
                    {errors.firstname.message}
                  </span>
                )}

                {/* Input Box for MiddleName */}
                <div className="flex lg:w-1/2 lg:flex-row mb-7 justify-start items-center px-3 border border-colorBoxSecondary rounded-md">
                  <div className="registration relative z-0 w-full">
                    <input
                      type="text"
                      name="middlename"
                      placeholder=" "
                      autoComplete="off"
                      className="text-colorTextSecondary pt-3 pb-2 px-5 block w-full  mt-0  bg-transparent focus:outline-none"
                      {...register("middlename")}
                    />
                    <label
                      htmlFor="middlename"
                      className="registration absolute duration-300 top-4 -z-1 origin-0 text-gray-500"
                    >
                      Middle name
                    </label>
                  </div>
                </div>

                {errors.middlename && (
                  <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-right-2 lg:w-1/2 relative  bottom-8">
                    {errors.middlename.message}
                  </span>
                )}
              </div>

              {/* Two Columns Input Boxes */}
              <div className="flex flex-col relative lg:flex-row lg:space-x-3 justify-center">
                {/* Input Box for LastName */}
                <div className="flex lg:w-1/2 lg:flex-row mb-7 justify-start items-center px-3 border border-colorBoxSecondary rounded-md">
                  <div className="registration relative z-0 w-full">
                    <input
                      type="text"
                      name="lastname"
                      placeholder=" "
                      autoComplete="off"
                      className="text-colorTextSecondary pt-3 pb-2 px-5 block w-full  mt-0  bg-transparent focus:outline-none"
                      {...register("lastname")}
                    />
                    <label
                      htmlFor="lastname"
                      className="registration absolute duration-300 top-4 -z-1 origin-0 text-gray-500"
                    >
                      Last name
                    </label>
                  </div>
                </div>

                {errors.lastname && (
                  <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-left-2 lg:w-1/2 relative  bottom-8">
                    {errors.lastname.message}
                  </span>
                )}

                {/* Input Box for Company */}
                <div className="flex lg:w-1/2 lg:flex-row mb-7 justify-start items-center px-3 border border-colorBoxSecondary rounded-md">
                  <div className="registration relative z-0 w-full">
                    <input
                      type="text"
                      name="company"
                      placeholder=" "
                      autoComplete="off"
                      className="text-colorTextSecondary pt-3 pb-2 px-5 block w-full  mt-0  bg-transparent focus:outline-none"
                      {...register("company")}
                    />
                    <label
                      htmlFor="company"
                      className="registration absolute duration-300 top-4 -z-1 origin-0 text-gray-500"
                    >
                      Company
                    </label>
                  </div>
                </div>

                {errors.company && (
                  <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-right-2 lg:w-1/2 relative  bottom-8">
                    {errors.company.message}
                  </span>
                )}
              </div>

              {/* Two Columns Input Boxes */}
              <div className="flex flex-col relative lg:flex-row lg:space-x-3 justify-center">
                {/* Input Box for Department */}
                <div className="flex lg:w-1/2 lg:flex-row mb-7 justify-start items-center px-3 border border-colorBoxSecondary rounded-md">
                  <div className="registration relative z-0 w-full">
                    <input
                      type="text"
                      name="department"
                      placeholder=" "
                      autoComplete="off"
                      className="text-colorTextSecondary pt-3 pb-2 px-5 block w-full  mt-0  bg-transparent focus:outline-none"
                      {...register("department")}
                    />
                    <label
                      htmlFor="department"
                      className="registration absolute duration-300 top-4 -z-1 origin-0 text-gray-500"
                    >
                      Department
                    </label>
                  </div>
                </div>

                {errors.department && (
                  <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-left-2 lg:w-1/2 relative  bottom-8">
                    {errors.department.message}
                  </span>
                )}

                {/* Input Box for Mobile Number */}
                <div className="flex lg:w-1/2 lg:flex-row mb-7 justify-start items-center px-3 border border-colorBoxSecondary rounded-md">
                  <div className="registration relative z-0 w-full">
                    <input
                      type="number"
                      onWheel={(e) => e.target.blur()}
                      name="contactnumber"
                      placeholder=" "
                      autoComplete="off"
                      className="text-colorTextSecondary pt-3 pb-2 px-5 block w-full  mt-0  bg-transparent focus:outline-none"
                      {...register("contactnumber")}
                    />
                    <label
                      htmlFor="contactnumber"
                      className="registration absolute duration-300 top-4 -z-1 origin-0 text-gray-500"
                    >
                      Mobile Number
                    </label>
                  </div>
                </div>

                {errors.contactnumber && (
                  <span className="text-red-500 lg:block lg:absolute lg:top-12 lg:-right-2 lg:w-1/2 relative  bottom-8">
                    {errors.contactnumber.message}
                  </span>
                )}
              </div>

              {/* Button Register */}
              <div className="flex flex-row">
                <button className="py-5  text-center w-full rounded-sm  text-colorTextTertiary bg-colorBrand mt-5 mb-5 text-sm text-softDark font-semibold hover:opacity-80 hover:scale-95 duration-300">
                  Sign Up
                </button>
                {isLoading && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-6 h-6 relative top-6 right-8 animate-spin-medium"
                  >
                    <path d="M17.004 10.407c.138.435-.216.842-.672.842h-3.465a.75.75 0 01-.65-.375l-1.732-3c-.229-.396-.053-.907.393-1.004a5.252 5.252 0 016.126 3.537zM8.12 8.464c.307-.338.838-.235 1.066.16l1.732 3a.75.75 0 010 .75l-1.732 3.001c-.229.396-.76.498-1.067.16A5.231 5.231 0 016.75 12c0-1.362.519-2.603 1.37-3.536zM10.878 17.13c-.447-.097-.623-.608-.394-1.003l1.733-3.003a.75.75 0 01.65-.375h3.465c.457 0 .81.408.672.843a5.252 5.252 0 01-6.126 3.538z" />
                    <path
                      fillRule="evenodd"
                      d="M21 12.75a.75.75 0 000-1.5h-.783a8.22 8.22 0 00-.237-1.357l.734-.267a.75.75 0 10-.513-1.41l-.735.268a8.24 8.24 0 00-.689-1.191l.6-.504a.75.75 0 10-.964-1.149l-.6.504a8.3 8.3 0 00-1.054-.885l.391-.678a.75.75 0 10-1.299-.75l-.39.677a8.188 8.188 0 00-1.295-.471l.136-.77a.75.75 0 00-1.477-.26l-.136.77a8.364 8.364 0 00-1.377 0l-.136-.77a.75.75 0 10-1.477.26l.136.77c-.448.121-.88.28-1.294.47l-.39-.676a.75.75 0 00-1.3.75l.392.678a8.29 8.29 0 00-1.054.885l-.6-.504a.75.75 0 00-.965 1.149l.6.503a8.243 8.243 0 00-.689 1.192L3.8 8.217a.75.75 0 10-.513 1.41l.735.267a8.222 8.222 0 00-.238 1.355h-.783a.75.75 0 000 1.5h.783c.042.464.122.917.238 1.356l-.735.268a.75.75 0 10.513 1.41l.735-.268c.197.417.428.816.69 1.192l-.6.504a.75.75 0 10.963 1.149l.601-.505c.326.323.679.62 1.054.885l-.392.68a.75.75 0 101.3.75l.39-.679c.414.192.847.35 1.294.471l-.136.771a.75.75 0 101.477.26l.137-.772a8.376 8.376 0 001.376 0l.136.773a.75.75 0 101.477-.26l-.136-.772a8.19 8.19 0 001.294-.47l.391.677a.75.75 0 101.3-.75l-.393-.679a8.282 8.282 0 001.054-.885l.601.504a.75.75 0 10.964-1.15l-.6-.503a8.24 8.24 0 00.69-1.191l.735.268a.75.75 0 10.512-1.41l-.734-.268c.115-.438.195-.892.237-1.356h.784zm-2.657-3.06a6.744 6.744 0 00-1.19-2.053 6.784 6.784 0 00-1.82-1.51A6.704 6.704 0 0012 5.25a6.801 6.801 0 00-1.225.111 6.7 6.7 0 00-2.15.792 6.784 6.784 0 00-2.952 3.489.758.758 0 01-.036.099A6.74 6.74 0 005.251 12a6.739 6.739 0 003.355 5.835l.01.006.01.005a6.706 6.706 0 002.203.802c.007 0 .014.002.021.004a6.792 6.792 0 002.301 0l.022-.004a6.707 6.707 0 002.228-.816 6.781 6.781 0 001.762-1.483l.009-.01.009-.012a6.744 6.744 0 001.18-2.064c.253-.708.39-1.47.39-2.264a6.74 6.74 0 00-.408-2.308z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </form>
            <div className="absolute h-5 bg-colorBrand bottom-0 w-full rounded-b-md"></div>
          </div>
        </div>
      )}
    </>
  );
};

export default RegistrationComponent;
