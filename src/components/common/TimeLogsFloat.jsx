import React, { useState, useEffect } from "react";
import { IoIosTime } from "react-icons/io";
import { useNavigate } from "react-router-dom";

export default function TimeLogsFloat() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHover, setIsHover] = useState(false);
  const [showClickMe, setShowClickMe] = useState(false);
  const navigate = useNavigate();
  const Clock =
    localStorage.getItem("apiendpoint") + import.meta.env.VITE_CLOCK_GIF;

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const toggleClickMe = setInterval(() => {
      setShowClickMe((prev) => !prev);
    }, 7000);

    return () => clearInterval(toggleClickMe);
  }, []);

  const formatTime = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  };

  const formattedTime = formatTime(currentTime);
  const [hours, minutes] = formattedTime.split(":");

  return (
    <div
      onMouseEnter={() => {
        setIsHover(true);
        setShowClickMe(false);
      }}
      onMouseLeave={() => setIsHover(false)}
      onClick={() => navigate(`/timelogs`)}
      className="transition-opacity duration-150 fixed cursor-pointer right-0 bottom-0 md:right-[60px] md:bottom-10 rounded-full p-4 flex items-center"
    >
      <div className="relative text-medPrimary flex flex-col items-center justify-center z-20">
        {/* <IoIosTime /> */}
        <img src={Clock} className="w-[50px] md:w-[100px]" />
        <div className="ml-4 flex items-center gap-2 font-mono px-5 py-2 bg-[#333333] rounded-md text-[15px] md:text-[25px] mt-3 shadow-md">
          <div className="">{hours}</div>
          <div className="text-white">:</div>
          <div className="text-white">{minutes}</div>
        </div>
      </div>
      <>
        {isHover && (
          <div
            className="ui-fade-in absolute top-[3.2rem] -left-20 font-bold -translate-y-1/2 z-auto translate-x-full bg-softerPrimary px-5 py-2 rounded-md"
          >
            <h1>Time Logs</h1>
            <div className="bg-inherit rotate-45 z-50 p-1 absolute top-1/2 -translate-y-1/2 -right-2 -translate-x-1/2"></div>
          </div>
        )}
      </>
      <>
        {!isHover && showClickMe && (
          <div
            className="ui-fade-in absolute top-[3.2rem] -left-20 font-bold -translate-y-1/2 z-10 translate-x-full bg-darkerPrimary text-white px-5 py-2 rounded-md"
          >
            <h1>Click Me</h1>
            <div className="bg-inherit rotate-45 z-50 p-1 absolute top-1/2 -translate-y-1/2 -right-2 -translate-x-1/2"></div>
          </div>
        )}
      </>
    </div>
  );
}
