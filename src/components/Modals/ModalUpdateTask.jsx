import React from "react";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const grades = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const ModalUpdateTask = ({
  header,
  message,
  setYesNoModalOpen,
  triggerYesNoEvent,
  taskGrade,
  setTaskGrade,
  approvalType,
  empId,
  taskId,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  return (
    <>
      <div className="h-screen w-screen bg-zinc-800 z-20 bg-opacity-50 fixed top-0 left-0">
        {" "}
        <div className="flex flex-row justify-center p-5 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-start w-full md:w-1/2">
            <div className="flex flex-col mt-20 h-auto pb-5 shadow-2xl rounded-xl bg-white z-20">
              <div className="flex flex-row justify-center text-white w-full   bg-gradient-to-br from-darkerPrimary via-darkPrimary to-medPrimary rounded-t-xl p-10">
                <motion.div
                  className="flex flex-row justify-center"
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-24 h-24"
                  >
                    <path
                      fillRule="evenodd"
                      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 01-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584zM12 18a.75.75 0 100-1.5.75.75 0 000 1.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </motion.div>
              </div>
              <div className="flex flex-col space-y-5 py-5">
                <h1 className="text-2xl font-serif text-center">{header}</h1>
                <p className="text-center">{message}</p>

                {/* Grading Section */}
                {approvalType === "Reviewed" && (
                  <div className="px-5 w-1/4 self-center">
                    <div className="relative z-0 w-full">
                      <p className="text-sm mb-3">Grade</p>
                      <div className="relative z-0 w-full mb-5">
                        <select
                          value={taskGrade}
                          onChange={(e) => setTaskGrade(e.target.value)}
                          className="pt-3 pb-2 text-xl text-center font-semibold px-5 block w-full rounded-lg items  mt-0 bg-transparent border-2 appearance-none z-1 focus:outline-none focus:ring-0 focus:border-zinc-500"
                        >
                          <option value="" disabled hidden></option>
                          {grades &&
                            grades.map((grade, index) => (
                              <option key={index} value={grade}>
                                {grade}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-row justify-center space-x-3">
                  <a
                    className="shadow-md cursor-pointer shadow-zinc-500 w-32 text-center transition-all duration-150 bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary text-white border-b-8 border-softPrimary rounded-lg hover:border-t-8 hover:border-b-0 hover:bg-darkerPrimary hover:border-t-softPrimary hover:shadow-lg"
                    onClick={() => {
                      triggerYesNoEvent(empId, taskId);
                      setYesNoModalOpen(false);
                    }}
                  >
                    <div className="hover:shadow-md hover:shadow-zinc-500 p-5 duration-150  bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary  rounded-lg hover:bg-green-700">
                      Yes
                    </div>
                  </a>
                  <a
                    className="shadow-md cursor-pointer shadow-zinc-500 w-32 text-center transition-all duration-150 bg-yellow-700 text-white border-b-8 border-b-yellow-700 rounded-lg hover:border-t-8 hover:border-b-0 hover:bg-yellow-700 hover:border-t-yellow-700 hover:shadow-lg"
                    onClick={() => {
                      setYesNoModalOpen(false);
                    }}
                  >
                    <div className="hover:shadow-md hover:shadow-zinc-500 p-5 duration-150 bg-yellow-500 rounded-lg hover:bg-yellow-700">
                      No
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalUpdateTask;
