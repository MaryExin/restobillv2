import React from "react";
import { FaSpinner } from "react-icons/fa";

const CircleSpinner = () => {
  return (
    <div
      className="flex items-center justify-center"
    >
      <FaSpinner className="ui-spin w-6 h-6 text-colorBrand" />
    </div>
  );
};

export default CircleSpinner;
