import React from "react";
import useZustandSideMenu from "../../context/useZustandSideMenu";

export default function CardCpm({ key, onClick, title, icon }) {
  return (
    <div
      key={key}
      onClick={onClick}
      className={`relative cursor-pointer min-w-full xl:min-w-[350px] hover:scale-[0.9] transform-all ease-in-out duration-[.2s]  flex flex-col border-b-4 border-darkerPrimary p-5 justify-between h-[160px] rounded-lg shadow-lg`}
    >
      <div className={`flex justify-between  w-full text-[25px] `}>
        <h3 className="text-[14px] font-bold text-black">{title}</h3>
        {/* {items.icon} */}
      </div>
      <div className="flex items-center gap-2">
        <h4
          className={`text-[35px] flex justify-end w-full text-darkerPrimary`}
        >
          {icon}
        </h4>
      </div>
    </div>
  );
}
