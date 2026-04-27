<?php
// Check if image data is present
if(isset($GLOBALS["HTTP_RAW_POST_DATA"])){
    // Get the raw image data
    $imageData=$GLOBALS['HTTP_RAW_POST_DATA'];

    // Create a unique filename for the image
    $fileName = uniqid() . '.jpg';

    // Specify the directory where you want to save the images
    $filePath = 'path_to_your_image_directory/' . $fileName;

    // Save the image to the specified directory
    file_put_contents($filePath, $imageData);

    // Optionally, you can return the filename or any other response to your frontend
    echo $fileName;
}
?>
