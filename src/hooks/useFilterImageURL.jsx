const useFilterImageURL = (imagePath) => {
  if (imagePath !== null) {
    const inputString = imagePath;

    // Split the input string by the 'images/employees/' substring
    const parts = inputString.split("images/employees/");

    // Get the second part of the split, which is 'EMP16950767305674_avatar.jpg'
    const imageName = parts[1];

    // Define the base URL
    const baseUrl = "https://sorpresawebapp.com/images/employees/";
    // Concatenate the base URL and the image path
    const imageUrl = baseUrl + imageName;

    return imageUrl;
  }

  return null;
};

export default useFilterImageURL;
