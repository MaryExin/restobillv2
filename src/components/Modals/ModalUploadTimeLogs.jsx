import React, { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { LinearProgress } from "@mui/material";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";
import { Link, useNavigate } from "react-router-dom";
import ModalYesNoUpload from "../Modals/ModalYesNoUpload";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { useQueryRefreshLogin } from "../../hooks/useQueryRefreshLogin";

const ModalUploadTimeLogs = ({ endpoint, setUploadOpen }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOPen, setIsModalOpen] = useState(false);
  const [isOpenModalYesNo, setYesNoModalOpen] = useState(false);

  /******* DRAG and DROP FUNCTIONS**********/

  // drag state
  const [dragActive, setDragActive] = useState(false);
  // ref
  const inputRef = useRef(null);

  // handle drag events
  const handleDrag = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // triggers when file is dropped
  const handleDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // handleFiles(e.dataTransfer.files);
      setSelectedFile(e.dataTransfer.files[0]);
      setFileName(e.dataTransfer.files[0].name);
    }
  };

  // triggers when file is selected with click
  const handleChange = function (e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    }
  };

  // triggers the input when the button is clicked
  const onButtonClick = () => {
    inputRef.current.click();
  };

  //Mutate data to api

  const uploadFileMutation = useMutation(async (file) => {
    const formData = new FormData();
    formData.append("csv_file", file);

    setIsLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access_token"),
        },
        body: formData,
      });

      setIsLoading(false);

      //If acces token was expired request another from refresh token
      if (response.status === 401) {
        refreshToken();
      }

      return response.json();
    } catch (error) {
      setIsLoading(false);
      console.error("An error occurred:", error);
    }
  });

  // Upload Trigger Event
  const handleUpload = () => {
    if (selectedFile) {
      uploadFileMutation.mutate(selectedFile);
      // if (uploadFileMutation.isSuccess) {
      //   openModal();
      // }
      if (uploadFileMutation.isError) {
        // console.log("Error");
      }
    }
  };

  //Issue new sets of refresh token when expired

  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const {
    isAuthenticated,
    toggleAuthentication,
    toggleAuthToTrue,
    toggleAuthToFalse,
    firstName,
    toggleFirstName,
    updateUserRole,
  } = useZustandLoginCred();

  const {
    data: refreshData,
    isLoading: refreshIsLoading,
    isError: refreshIsError,
    isSuccess: refreshIsSuccess,
    refetch: refreshRefetch,
  } = useQueryRefreshLogin();

  useEffect(() => {
    if (uploadFileMutation.data) {
      if (uploadFileMutation.data.message === "token has expired") {
        queryClient.invalidateQueries({ queryKey: ["jwt"] });
        refreshRefetch();
      }
    }
  }, [uploadFileMutation.data]);

  useEffect(() => {
    if (refreshData) {
      if (refreshData.message === "loginsuccess") {
        localStorage.setItem("access_token", refreshData.access_token);
        toggleAuthToTrue();
        toggleFirstName(refreshData.username);
        updateUserRole(refreshData.userrole);
      }
      if (refreshData.message === "refresh token has expired") {
        toggleAuthToFalse;
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        navigate(0);
      }
    }
  }, [refreshData]);

  // End of token refresh

  useEffect(() => {
    if (uploadFileMutation.data) {
      if (uploadFileMutation.data.message === "success") {
        setIsModalOpen(true);
      }
    }
    // console.log(uploadFileMutation.data);
  }, [uploadFileMutation.data]);

  const resetForm = () => {
    setSelectedFile(null);
    setFileName(null);
  };
  return (
    <>
      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div className="flex flex-row justify-center p-5 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-start w-full md:w-1/3">
            <div className="flex flex-col mt-20 h-auto pb-5 shadow-2xl rounded-xl bg-white z-20">
              <div className="mt-10 ">
                <form
                  id="form-file-upload"
                  onDragEnter={handleDrag}
                  onSubmit={(e) => e.preventDefault()}
                  className="w-full text-center relative shadow-2xl p-8 rounded-lg"
                >
                  <div className="flex justify-between">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6 text-darkerPrimary hover:-translate-y-1 duration-300 cursor-pointer mb-3"
                      onClick={() => resetForm()}
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      className="w-6 h-6 text-darkerPrimary hover:-translate-y-1 duration-300 cursor-pointer mb-3"
                      onClick={() => setUploadOpen(false)}
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                      />
                    </svg>
                  </div>

                  {isOpenModalYesNo && (
                    <ModalYesNoUpload
                      header={"Confirm upload?"}
                      message={"Choose yes or no"}
                      setYesNoModalOpen={setYesNoModalOpen}
                      setIsModalOpen={setIsModalOpen}
                      triggerYesNoEvent={handleUpload}
                    />
                  )}
                  {uploadFileMutation.isLoading && (
                    <LinearProgress color="warning" />
                  )}
                  {isModalOPen && (
                    <ModalSuccessNavToSelf
                      header={"Success"}
                      message={"CSV file was uploaded successfully"}
                      button={"Accept"}
                      setIsModalOpen={setIsModalOpen}
                      resetForm={resetForm}
                    />
                  )}

                  <input
                    ref={inputRef}
                    type="file"
                    id="input-file-upload"
                    //   multiple={true}
                    accept=".csv"
                    onChange={handleChange}
                    className="hidden"
                  />
                  <div
                    id="label-file-upload"
                    htmlFor="input-file-upload"
                    className={
                      dragActive
                        ? "flex flex-col space-y-5 justify-center h-3/4 shadow-lg rounded-lg p-5 border-2 border-dashed border-darkerPrimary"
                        : ""
                    }
                  >
                    <div className="flex flex-col space-y-5">
                      <div className="flex flex-col justify-center space-y-3 p-16 bg-softerPrimary rounded-xl">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-10 h-10 text-darkerPrimary"
                        >
                          <path
                            fillRule="evenodd"
                            d="M19.5 21a3 3 0 003-3V9a3 3 0 00-3-3h-5.379a.75.75 0 01-.53-.22L11.47 3.66A2.25 2.25 0 009.879 3H4.5a3 3 0 00-3 3v12a3 3 0 003 3h15zm-6.75-10.5a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25v2.25a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V10.5z"
                            clipRule="evenodd"
                          />
                        </svg>

                        <p
                          className={
                            fileName
                              ? "text-lg font-bold bg-yellow-200 text-colorTextSecondary p-3 rounded-lg"
                              : "text-lg font-bold"
                          }
                        >
                          {fileName ? (
                            <p>
                              File to be uploaded:{" "}
                              <span className="text-lg bg-darkerPrimary font-semibold text-white px-3 py-1 rounded-lg">
                                {fileName}
                              </span>
                            </p>
                          ) : (
                            `Drag and drop your .csv file in here`
                          )}
                        </p>
                      </div>

                      <h1 className="font-semibold">OR</h1>

                      <button
                        className="w-full bg-softerPrimary p-3 rounded-lg hover:scale-95 duration-300 font-semibold"
                        onClick={onButtonClick}
                      >
                        Upload a file
                      </button>
                    </div>
                  </div>
                  {dragActive && (
                    <div
                      id="drag-file-element"
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className="absolute w-full h-full rounded-xl bg-softerPrimary opacity-50 top-0 bottom-0 start-0 end-0"
                    ></div>
                  )}
                  <div className="flex flex-row justify-end">
                    <button
                      onClick={() => setYesNoModalOpen(true)}
                      disabled={isLoading || uploadFileMutation.isLoading} // Consider both isLoading states
                      className="p-3 bg-gradient-to-br text-white from-darkerPrimary via-darkPrimary  to-medPrimary mt-5 w-1/3 shadow-lg shadow-zinc-400 rounded-md hover:scale-95 duration-300"
                    >
                      Submit
                    </button>
                  </div>

                  {(isLoading || uploadFileMutation.isLoading) && (
                    <p>Loading...</p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalUploadTimeLogs;
