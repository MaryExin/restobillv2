import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const CmpUploadPage = () => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOPen, setIsModalOPen] = useState(false);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const uploadFileMutation = useMutation(async (file) => {
    const formData = new FormData();
    formData.append("csv_file", file);

    setIsLoading(true);

    try {
      const response = await fetch(
        localStorage.getItem("apiendpoint") +
          import.meta.env.VITE_UPLOADCSV_ENDPOINT,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access_token"),
          },
          body: formData,
        }
      );

      setIsLoading(false);

      return response.json();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  });

  const handleUpload = () => {
    if (selectedFile) {
      uploadFileMutation.mutate(selectedFile);
      // console.log(uploadFileMutation.data);
    }
  };

  return (
    <div className="mt-20">
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button
        onClick={handleUpload}
        disabled={isLoading || uploadFileMutation.isLoading} // Consider both isLoading states
        className="p-3 bg-green-300"
      >
        Upload
      </button>
      {(isLoading || uploadFileMutation.isLoading) && <p>Loading...</p>}
    </div>
  );
};

export default CmpUploadPage;
