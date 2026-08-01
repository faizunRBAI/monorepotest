import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

const ImageCropper = ({ imageSrc, onCropComplete, onCancel, aspect = 21 / 9 }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const onCropChange = (crop) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom) => {
        setZoom(zoom);
    };

    const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const showCroppedImage = async () => {
        try {
            const croppedImage = await getCroppedImg(
                imageSrc,
                croppedAreaPixels
            );
            onCropComplete(croppedImage);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1000, background: 'rgba(0,0,0,0.8)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{ position: 'relative', width: '90%', height: '70%', background: '#333' }}>
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect} // Dynamic aspect ratio
                    onCropChange={onCropChange}
                    onZoomChange={onZoomChange}
                    onCropComplete={onCropCompleteCallback}
                />
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button onClick={onCancel} style={{
                    padding: '0.75rem 1.5rem', background: '#fff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600
                }}>
                    Cancel
                </button>
                <button onClick={showCroppedImage} style={{
                    padding: '0.75rem 1.5rem', background: '#d62020', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600
                }}>
                    Crop & Upload
                </button>
            </div>
            <div style={{ marginTop: '1rem' }}>
                <label style={{ color: '#fff', marginRight: '0.5rem' }}>Zoom</label>
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(e.target.value)}
                    className="zoom-range"
                />
            </div>
        </div>
    );
};

export default ImageCropper;
