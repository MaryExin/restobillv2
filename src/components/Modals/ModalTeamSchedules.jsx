import React from "react";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCalendarDays } from "react-icons/fa6";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalTeamSchedules = ({ data, onClose }) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const navigate = useNavigate();

  const formatDateTime = (date) => {
    const options = {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // Use 12-hour clock
    };
    return new Intl.DateTimeFormat("en-US", options).format(date);
  };

  // Function to determine the background color based on category
  const getCategoryBackgroundColor = (category) => {
    switch (category) {
      case "Team Meeting":
        return "bg-teal-500";
      case "Team Training":
        return "bg-amber-500";
      case "Client Meeting":
        return "bg-blue-500";
      case "Client Training":
        return "bg-violet-500";
      case "System Installation":
        return "bg-fuchsia-500";
      case "Others":
        return "bg-green-300";
      default:
        return "bg-gray-500";
    }
  };

  // Get the background color class based on the event category
  const backgroundColorClass = getCategoryBackgroundColor(
    data.extendedProps.category
  );

  return (
    <>
      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div className="flex flex-row justify-center px-10 pt-10 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-start w-full md:w-1/2">
            <div className="flex flex-col mt-20 h-auto pb-5 shadow-2xl rounded-xl bg-slate-50 z-20">
              <div
                className={`flex flex-row justify-center text-white w-full ${backgroundColorClass} rounded-t-xl p-10`}
              >
                <motion.div
                  className="flex flex-row justify-center"
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <FaCalendarDays className="text-5xl" />
                </motion.div>
              </div>
              <div className="flex flex-col space-y-5 py-5">
                <h1 className="text-2xl text-center font-bold pb-5">
                  {data.title}
                </h1>
                <div className="flex flex-row px-5 md:px-10 gap-2 text-xs md:text-sm">
                  <div className="w-28 font-bold">Start: </div>
                  <div>{formatDateTime(data.start)}</div>
                </div>
                <div className="flex flex-row px-5 md:px-10 gap-2 text-xs md:text-sm">
                  <div className="w-28 font-bold">End: </div>
                  <div>{formatDateTime(data.end)}</div>
                </div>
                <div className="flex flex-row px-5 md:px-10 gap-2 text-xs md:text-sm">
                  <div className="w-28 font-bold">Category: </div>
                  <div>{data.extendedProps.category}</div>
                </div>
                <div className="flex flex-row px-5 md:px-10 gap-2 text-xs md:text-sm">
                  <div className="w-28 font-bold">Details: </div>
                  <div>{data.extendedProps.details}</div>
                </div>
                <div className="flex flex-row px-5 md:px-10 gap-2 text-xs md:text-sm">
                  <div className="w-28 font-bold">Participant(s): </div>
                  <div>{data.extendedProps.participants}</div>
                </div>
                <div className="flex flex-row justify-center">
                  <div
                    className="px-5 py-3 border border-slate-500 hover:bg-slate-400 rounded-lg duration-150 text-slate-500 hover:text-white cursor-pointer"
                    onClick={onClose}
                  >
                    Close
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalTeamSchedules;
