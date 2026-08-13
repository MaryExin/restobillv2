<?php

class ImageCompressor
{

    private $conn;

    public function __construct()
    {

    }

    public function compressToJpeg($sourceFile, $targetFile, $quality)
    {
        $image = imagecreatefromstring(file_get_contents($sourceFile));
        imagejpeg($image, $targetFile, $quality);
        imagedestroy($image);
    }

}
