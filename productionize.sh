#!/bin/bash

FOLDER=$1

rm -rf $FOLDER
mkdir -p $FOLDER
cp -R ./pokki/* $FOLDER
sed '/Pokki/d' $FOLDER/popup.html > $FOLDER/index.html 
rm -f $FOLDER/popup.html
rm -f $FOLDER/manifest.json