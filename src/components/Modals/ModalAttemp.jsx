import React from "react";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalAttemp = ({ header, message, button, route }) => {
  const navigate = useNavigate();
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  return (
    <>
      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div className="flex flex-row justify-center px-10 pt-10 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-start w-full md:w-1/2">
            <div className="flex flex-col mt-20 h-auto pb-5 shadow-2xl rounded-xl bg-slate-50 z-20">
              <div className="flex flex-row justify-center text-white w-full  bg-red-400 rounded-t-xl p-10">
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
                    className="w-24 h-24 text-softDark"
                  >
                    <motion.path
                      fillRule="evenodd"
                      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                      clipRule="evenodd"
                    />
                  </svg>
                </motion.div>
              </div>
              <div className="flex flex-col space-y-5 py-5">
                <h1 className="text-2xl font-serif text-center">{header}</h1>
                <p className="text-center">{message}</p>
                <div className="flex flex-row justify-center">
                  <Link
                    className="shadow-md shadow-zinc-500 w-32 text-center transition-all duration-150 bg-red-500 text-white border-b-8 border-red-200 rounded-lg hover:border-t-8 hover:border-b-0 hover:bg-red-500 hover:border-red-200 hover:shadow-lg"
                    to={route}
                  >
                    <div className="hover:shadow-md hover:shadow-zinc-500 p-5 duration-150 bg-red-500 rounded-lg hover:bg-red-500">
                      {button}
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalAttemp;
