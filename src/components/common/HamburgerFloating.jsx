import Hamburger from "hamburger-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * @typedef {Object} HamburgerMenuItem
 * @property {string} tittle
 * @property {number} delay
 * @property {function():void} [showData]
 */

/**
 * @typedef {Object} HamBurgerFloatingMenuProps
 * @property {HamburgerMenuItem[]} hamburgerMenu
 */

/**
 * @param {HamBurgerFloatingMenuProps} props
 */
const HamBurgerFloatingMenu = ({ hamburgerMenu }) => {
  const [isOpen, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = (showData) => {
    navigate(showData);
    if (showData) showData();
    setOpen(false);
  };

  return (
    <div
      className="bg-white border-2 fixed right-[60px] bottom-10 rounded-full z-40"
    >
      <div className="relative z-50">
        <Hamburger toggled={isOpen} size={30} toggle={setOpen} />
      </div>
      {isOpen && (
        <div className="absolute  -top-[65vh] -left-[265px]  lg:-top-[380px] lg:-left-[490px] px-5 ">
          <ul className="grid grid-cols-1 lg:grid-cols-2 w-[300px] lg:w-[600px] p-5 gap-2 text-center">
            {hamburgerMenu.map((item, index) => (
              <div onClick={() => navigate(`/${item.link}`)}>
                <li
                  onClick={() => handleClick(item.showData)}
                  key={index}
                  className="ui-enter bg-white shadow-lg p-5  rounded-xl hover:text-white hover:bg-medPrimary cursor-pointer transition-all ease-in-out"
                >
                  {item.tittle}
                </li>
              </div>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HamBurgerFloatingMenu;
