// image-processor.js - Handles all image processing for card backgrounds

// Store the current background file globally for reprocessing
let currentBgFile = null;

/**
 * Process image with blur and brightness for card background
 * @param {File} file - The image file to process
 * @param {number} opacity - Opacity value between 0 and 1
 * @returns {Promise<File>} - Processed image file
 */
async function processImageForCard(file, opacity = 0.7) {
    console.log('Starting image processing for:', file.name, 'Size:', file.size, 'Opacity:', opacity);
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = function() {
            console.log('Image loaded:', img.width, 'x', img.height);
            
            // Set canvas size to maintain aspect ratio (1.6:1 for card)
            const targetAspectRatio = 1.6;
            let width = img.width;
            let height = img.height;
            const currentAspectRatio = width / height;
            
            // Crop to fit card aspect ratio
            if (currentAspectRatio > targetAspectRatio) {
                // Image is wider, crop width
                width = height * targetAspectRatio;
            } else {
                // Image is taller, crop height
                height = width / targetAspectRatio;
            }
            
            // Set reasonable max dimensions to optimize file size
            const maxWidth = 800;
            if (width > maxWidth) {
                width = maxWidth;
                height = width / targetAspectRatio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            console.log('Canvas dimensions set to:', width, 'x', height);
            
            // Apply stronger filters for better stamp visibility
            ctx.filter = 'blur(5px) brightness(150%)';
            console.log('Applying filters:', ctx.filter);
            
            // Set global alpha for transparency
            ctx.globalAlpha = opacity;
            console.log('Applying opacity:', opacity);
            
            // Draw image centered and cropped
            const sx = (img.width - width * (img.width / width)) / 2;
            const sy = (img.height - height * (img.height / height)) / 2;
            ctx.drawImage(img, sx, sy, img.width, img.height, 0, 0, width, height);
            
            console.log('Image drawn to canvas');
            
            // Convert canvas to blob
            canvas.toBlob((blob) => {
                if (blob) {
                    console.log('Blob created successfully, size:', blob.size);
                    const processedFile = new File([blob], file.name, { type: 'image/jpeg' });
                    console.log('Processed file created, size:', processedFile.size);
                    resolve(processedFile);
                } else {
                    console.error('Failed to create blob from canvas');
                    reject(new Error('Failed to process image'));
                }
            }, 'image/jpeg', 0.85); // 85% quality for good balance
        };
        
        img.onerror = () => {
            console.error('Failed to load image:', file.name);
            reject(new Error('Failed to load image'));
        };
        
        // Read the file
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('File read successfully');
            img.src = e.target.result;
        };
        reader.onerror = () => {
            console.error('Failed to read file:', file.name);
            reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Process and show preview of background image
 * @param {File} file - The image file to process
 * @param {number} opacity - Opacity value between 0 and 1
 */
async function processAndShowPreview(file, opacity) {
    try {
        console.log('Attempting to process image with opacity:', opacity);
        const processedFile = await processImageForCard(file, opacity);
        console.log('Preview processing complete');
        
        const processedReader = new FileReader();
        processedReader.onload = (e) => {
            const bgImagePreview = document.getElementById('bg-image-preview');
            if (bgImagePreview) {
                bgImagePreview.src = e.target.result;
                bgImagePreview.style.display = 'block';
                console.log('Processed preview displayed');
            }
        };
        processedReader.readAsDataURL(processedFile);
    } catch (error) {
        console.error('Preview processing failed:', error);
        // Fall back to showing original if processing fails
        const reader = new FileReader();
        reader.onload = (e) => {
            const bgImagePreview = document.getElementById('bg-image-preview');
            if (bgImagePreview) {
                bgImagePreview.src = e.target.result;
                bgImagePreview.style.display = 'block';
                console.log('Showing original image as fallback');
            }
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Upload image to Supabase Storage
 * @param {File} file - The file to upload
 * @param {string} type - Type of image ('backgrounds' or 'logos')
 * @param {string} restaurantId - Restaurant ID for naming
 * @returns {Promise<string>} - Public URL of uploaded image
 */
async function uploadImage(file, type, restaurantId) {
    console.log('=== UPLOAD START ===');
    console.log('Type:', type, 'Restaurant ID:', restaurantId);
    console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    // Check if supabase is defined
    if (typeof supabase === 'undefined') {
        console.error('ERROR: Supabase client is not defined!');
        throw new Error('Supabase client not initialized');
    }
    
    // Process background images before upload
    let fileToUpload = file;
    if (type === 'backgrounds') {
        try {
            const opacitySlider = document.getElementById('bg-opacity');
            const opacity = opacitySlider ? opacitySlider.value / 100 : 0.7;
            console.log('Processing with opacity:', opacity);
            
            fileToUpload = await processImageForCard(file, opacity);
            console.log('Processing complete. New size:', fileToUpload.size);
        } catch (error) {
            console.error('Processing failed, using original:', error);
            fileToUpload = file;
        }
    }
    
    // Generate unique filename with timestamp and random string
    const fileExt = file.name.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${restaurantId}_${timestamp}_${random}.${fileExt}`;
    const bucket = type === 'backgrounds' ? 'card-backgrounds' : 'restaurant-logos';
    
    console.log('Uploading to bucket:', bucket);
    console.log('Filename:', fileName);
    
    try {
        // Upload the file
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, fileToUpload, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (uploadError) {
            console.error('Upload failed:', uploadError);
            console.error('Error details:', {
                message: uploadError.message,
                statusCode: uploadError.statusCode,
                error: uploadError.error
            });
            
            // Provide helpful error messages
            if (uploadError.statusCode === 404) {
                console.error('Bucket not found. Create bucket:', bucket);
            } else if (uploadError.statusCode === 403) {
                console.error('Permission denied. Check bucket is PUBLIC');
            } else if (uploadError.statusCode === 401) {
                console.error('Not authenticated. Check user session');
            }
            
            throw uploadError;
        }
        
        console.log('Upload successful:', uploadData);
        
        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);
        
        console.log('Public URL:', publicUrl);
        console.log('=== UPLOAD COMPLETE ===');
        
        return publicUrl;
        
    } catch (error) {
        console.error('=== UPLOAD ERROR ===');
        throw error;
    }
}

/**
 * Test storage bucket configuration
 */
async function testStorageSetup() {
    console.log('=== TESTING STORAGE SETUP ===');
    
    // Check if supabase exists
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase client not found');
        return;
    }
    console.log('✅ Supabase client found');
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('❌ No authenticated user:', authError);
        return;
    }
    console.log('✅ User authenticated:', user.email);
    
    // Test each bucket
    const buckets = ['card-backgrounds', 'restaurant-logos'];
    
    for (const bucket of buckets) {
        console.log(`\nTesting bucket: ${bucket}`);
        
        // Try to list files (this will tell us if bucket exists and is accessible)
        const { data: listData, error: listError } = await supabase.storage
            .from(bucket)
            .list('', { limit: 1 });
        
        if (listError) {
            console.error(`❌ Cannot access bucket "${bucket}":`, listError);
            console.error('Make sure the bucket exists and is set to PUBLIC');
        } else {
            console.log(`✅ Bucket "${bucket}" is accessible`);
            
            // Try a test upload
            const testFile = new File(['test'], `test-${Date.now()}.txt`, { type: 'text/plain' });
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(`test-${Date.now()}.txt`, testFile);
            
            if (uploadError) {
                console.error(`❌ Cannot upload to "${bucket}":`, uploadError);
                console.error('Check if bucket is PUBLIC and allows uploads');
            } else {
                console.log(`✅ Upload test successful for "${bucket}"`);
                
                // Clean up test file
                await supabase.storage.from(bucket).remove([uploadData.path]);
            }
        }
    }
    
    console.log('\n=== STORAGE TEST COMPLETE ===');
}

// Add to window for easy testing
if (typeof window !== 'undefined') {
    window.testStorageSetup = testStorageSetup;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        processImageForCard,
        processAndShowPreview,
        uploadImage,
        currentBgFile,
        testStorageSetup
    };
}