import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import ModalYesNoReusable from "./ModalYesNoReusable";
import ModalSuccessNavToSelf from "./ModalSuccessNavToSelf";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import CmpSubmitTicket from "../TicketingComponents/CmpSubmitTicket";
import ModalFailure from "./ModalFailure";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalAddTicket = ({ open, onClose, userId, refetch }) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [modalYesNoOpen, setYesNoModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState(false);
  const [ticketstype, setTicketstype] = useState("");
  const [ticketdesc, setTicketdesc] = useState("");
  const [ticketprior, setTicketprior] = useState("");
  const [isFailureModalOpen, setFailureModalOpen] = useState(false);
  // console.log(userId);
  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const {
    data: ticketData,
    isLoading: ticketIsLoading,
    isError: ticketIsError,
    isSuccess: ticketIsSuccess,
    mutate: ticketMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_TICKETING_ENDPOINT,
    "POST"
  );

  const {
    data: ticketEmailData,
    isLoading: ticketEmailIsLoading,
    isError: ticketEmailIsError,
    isSuccess: ticketEmailIsSuccess,
    mutate: ticketEmailMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_TICKETING_SUBMIT_ENDPOINT,
    "POST"
  );

  // Submission handler
  const onSubmit = () => {
    ticketMutate({
      tickettype: ticketstype,
      ticketdescription: ticketdesc,
      priority: ticketprior,
      empid: userId,
      // client: "Lightem",
    });
    ticketEmailMutate({
      tickettype: ticketstype,
      ticketdescription: ticketdesc,
      priority: ticketprior,
      empid: userId,
      //  client: "Lightem",
    });
    //Trigger Yes/No Modal for confirmation
    setModalSuccess(true);
  };
  useEffect(() => {
    if (ticketData) {
      if (ticketData.message === "Success") {
        // Delay the execution of onClose by 1000 milliseconds (1 second)
        const timer = setTimeout(() => {
          setTicketstype("Select Ticket Type");
          setTicketdesc("");
          setTicketprior("Select Priority");
          onClose();
          refetch();
        }, 1000); // Adjust the time (in milliseconds) as needed
        // Clean up the timer if the component unmounts or ticketData changes
        return () => clearTimeout(timer);
      } else if (ticketData.message === "Error") {
        setFailureModalOpen(true);
      }
    }
  }, [ticketData]);

  return (
    <>
      {modalYesNoOpen && (
        <ModalYesNoReusable
          header={"Confirmation"}
          message={"Select yes to proceed or no to exit"}
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={() => onSubmit()}
        />
      )}

      {modalSuccess && (
        <ModalSuccessNavToSelf
          header="Post Success"
          message={"Ticket Submitted "}
          button={"Accept"}
          setIsModalOpen={setModalSuccess}
        />
      )}
      {isFailureModalOpen && (
        <ModalFailure
          header="Post Failed"
          message={"Busunit Setup null"}
          button={"Accept"}
          setIsModalOpen={setFailureModalOpen}
        />
      )}
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg w-full max-w-lg p-5 border-2 shadow-lg relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
          >
            &times;
          </button>

          <h1 className="text-xl text-zinc-600 mb-10">Submit Ticket</h1>

          {/* Ticket Type */}
          <div className="relative z-0 mb-7">
            <select
              name="ticketType"
              value={ticketstype}
              className={`pt-3 pb-2 px-5 block w-full rounded-lg bg-transparent border-2 appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200 ${
                errors.ticketType ? "border-red-500" : ""
              }`}
              {...register("ticketType", {
                required: "Please select a ticket type",
              })}
              onChange={(e) => setTicketstype(e.target.value)}
            >
              <option value="">Select Ticket Type</option>
              <option value="Concern">Concern</option>
              <option value="Request">Request</option>
            </select>
            <label
              htmlFor="ticketType"
              className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500"
            >
              Ticket Type
            </label>
            {errors.ticketType && (
              <p className="text-red-500 text-sm mt-1">
                {errors.ticketType.message}
              </p>
            )}
          </div>
          {/* Description */}
          <div className="relative z-0 mb-7">
            <textarea
              name="description"
              placeholder=" "
              value={ticketdesc}
              rows="4"
              style={{ height: "150px" }} // Adjust the height as needed
              className={`pt-3 pb-2 px-5 block w-full rounded-lg mt-0 bg-transparent scrollbar border-2 appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200 ${
                errors.description ? "border-red-500" : ""
              }`}
              {...register("description", {
                required: "Description is required",
              })}
              onChange={(e) => setTicketdesc(e.target.value)}
            />
            <label
              htmlFor="description"
              className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500"
            >
              Description
            </label>
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="relative z-0 mb-7">
            <select
              name="priority"
              className={`pt-3 pb-2 px-5 block w-full rounded-lg bg-transparent border-2 appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200 ${
                errors.priority ? "border-red-500" : ""
              }`}
              {...register("priority", {
                required: "Please select a priority",
              })}
              value={ticketprior}
              onChange={(e) => setTicketprior(e.target.value)}
            >
              <option value="">Select Priority</option>
              <option value="Important and Urgent">Important and Urgent</option>
              <option value="Urgent but Not Important">
                Urgent but Not Important
              </option>
              <option value="Important but Not Urgent">
                Important but Not Urgent
              </option>
              {/* <option value="Not Important nor Urgent">
                Not Important nor Urgent
              </option> */}
            </select>
            <label
              htmlFor="priority"
              className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500"
            >
              Priority
            </label>
            {errors.priority && (
              <p className="text-red-500 text-sm mt-1">
                {errors.priority.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="bg-darkerPrimary text-white py-2 px-4 rounded w-full hover:bg-softPrimary duration-700"
            onClick={() => setYesNoModalOpen(true)}
          >
            Submit
          </button>
        </div>
      </div>
    </>
  );
};

export default ModalAddTicket;
