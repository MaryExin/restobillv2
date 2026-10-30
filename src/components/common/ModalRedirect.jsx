
export default function ModalRedirect({ countdown, header, body }) {
  return (
    <>
      <div
        className="ui-fade-in fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center backdrop-blur-sm"
      >
        <div
          className="ui-scale-in bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-2">{header}</h2>
          <p className="text-gray-500 mb-6">{body}</p>
          <div className="flex justify-center items-center mb-4">
            <div
              key={countdown}
              className="ui-scale-in text-5xl font-bold text-colorBrand"
            >
              {countdown}
            </div>
          </div>
          <p className="text-sm text-gray-400">Redirecting shortly...</p>
        </div>
      </div>
    </>
  );
}
