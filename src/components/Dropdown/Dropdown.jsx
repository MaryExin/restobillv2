import React, { Fragment, useEffect, useState, useRef } from "react";
import { Transition, Popover } from "@headlessui/react";
import { FaCheck } from "react-icons/fa";
import { HiChevronUpDown } from "react-icons/hi2";

Dropdown.defaultProps = {
  options: [],
  value: "",
  label: "Select",
  isRequired: false,
};

export default function Dropdown({
  label,
  value,
  isRequired,
  optionsList = [],
  optionsField01,
  optionsField02,
  concatID,
  allowCustom,
  enableBrandColor,
  onChange,
}) {
  // Always include an empty-first option
  const baseOptions = [{ id: "", optionItem: "" }];
  const mappedOptions = Array.isArray(optionsList)
    ? optionsList.map((option) => ({
        id: option[optionsField01],
        optionItem: option[optionsField02],
      }))
    : [];

  const options = [...baseOptions, ...mappedOptions];

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(value || "");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [shouldFocusInput, setShouldFocusInput] = useState(true);
  const optionsRefs = useRef([]);
  const popoverButtonRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState("bottom");

  useEffect(() => {
    // Reset to empty if no optionsList provided
    if (optionsList) {
      if (!optionsList.length) {
        setSelected("");
      } else {
        setSelected(value);
      }
    }
  }, [value, optionsList]);

  useEffect(() => {
    if (isPopoverOpen) {
      const idx = filteredOptions.findIndex(
        (opt) => opt.optionItem === selected
      );
      setFocusedIndex(idx);
      if (idx !== -1 && optionsRefs.current[idx]) {
        optionsRefs.current[idx].scrollIntoView({ block: "nearest" });
      }
    }
  }, [isPopoverOpen, selected]);

  useEffect(() => {
    if (focusedIndex !== -1 && optionsRefs.current[focusedIndex]) {
      optionsRefs.current[focusedIndex].scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const handleInputChange = (e) => setQuery(e.target.value);

  const handleKeyDown = (e, close) => {
    if (e.key === "ArrowDown")
      setFocusedIndex((i) => (i < filteredOptions.length - 1 ? i + 1 : 0));
    if (e.key === "ArrowUp")
      setFocusedIndex((i) => (i > 0 ? i - 1 : filteredOptions.length - 1));
    if (e.key === "Enter" && focusedIndex >= 0) {
      const opt = filteredOptions[focusedIndex];
      handleSelectionChange(opt.id, opt.optionItem, close);
      e.preventDefault();
    }
  };

  const handleSelectionChange = (id, val, close) => {
    setSelected(val);
    setQuery("");
    onChange?.(id, val);
    close();
  };

  const filteredOptions = query
    ? options.filter((o) =>
        (o.optionItem || "")
          .toLowerCase()
          .replace(/\s+/g, "")
          .includes(query.toLowerCase().replace(/\s+/g, ""))
      )
    : options;

  useEffect(() => {
    const onResize = () => setShouldFocusInput(window.innerWidth >= 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const checkPopoverPosition = () => {
    const rect = popoverButtonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setPopoverPosition(
      spaceBelow < 200 && spaceAbove > spaceBelow ? "top" : "bottom"
    );
  };

  return (
    <Popover className="relative w-full">
      {({ open, close }) => {
        useEffect(() => {
          setIsPopoverOpen(open);
          if (open) checkPopoverPosition();
        }, [open]);

        return (
          <>
            <div>
              <label className="block text-sm font-medium text-black">
                {label}
                {isRequired && <span className="text-red-500">*</span>}
              </label>
              <Popover.Button
                ref={popoverButtonRef}
                className={`flex items-center justify-between w-full h-10 px-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-black/25 focus:border-black transition ${
                  open ? "ring-2 ring-black border-black" : "border-gray-300"
                } bg-white text-black`}
              >
                <span className="truncate text-sm">{selected || ""}</span>
                <HiChevronUpDown className="w-5 h-5 text-black" />
              </Popover.Button>
            </div>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-75"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <Popover.Panel
                className={`absolute z-10 w-full ${
                  popoverPosition === "top" ? "bottom-full mb-2" : "mt-1"
                } bg-white border border-gray-300 rounded-md shadow-lg focus:outline-none`}
                onKeyDown={(e) => handleKeyDown(e, close)}
              >
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border-b border-gray-300 focus:outline-none sticky top-0 bg-white resize-none"
                  placeholder="Search..."
                  value={query}
                  onChange={handleInputChange}
                  autoFocus={shouldFocusInput}
                  style={{
                    fontSize: "16px",
                    maxWidth: "100%",
                  }}
                />

                {allowCustom && query && filteredOptions.length === 0 && (
                  <div
                    onClick={() => handleSelectionChange(0, query, close)}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 text-black"
                  >
                    Create “{query}”
                  </div>
                )}

                <div className="max-h-64 overflow-auto z-50">
                  {filteredOptions.map((option, i) => (
                    <div
                      key={i}
                      ref={(el) => (optionsRefs.current[i] = el)}
                      onMouseEnter={() => setFocusedIndex(i)}
                      onClick={() =>
                        handleSelectionChange(
                          option.id,
                          option.optionItem,
                          close
                        )
                      }
                      className={`flex items-center px-3 py-2 text-sm cursor-pointer ${
                        selected === option.optionItem
                          ? "bg-black text-white"
                          : "text-black"
                      } ${
                        focusedIndex === i && selected !== option.optionItem
                          ? "bg-gray-200"
                          : ""
                      }`}
                    >
                      {selected === option.optionItem && (
                        <FaCheck className="w-4 h-4 mr-2" />
                      )}
                      <span className="truncate">
                        {option.optionItem}
                        {concatID ? ` | ${option.id}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Popover.Panel>
            </Transition>
          </>
        );
      }}
    </Popover>
  );
}
