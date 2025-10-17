// card-designer.js - Complete implementation with working Google Places API and Promotion Rules

// Global variables for Places API
let placesSearchTimeout = null;
let placesAutocompleteSession = null;

// Global variables for image processing
var currentBgFile = null;
var processedBgBlob = null;

/**
 * Initialize card designer with live preview bindings
 */
function initializeCardDesigner() {
    // Restaurant Display Name
    const displayNameInput = document.getElementById('display-name');
    const cardTitle = document.getElementById('title-preview');
    const locationSubtitle = document.getElementById('location-subtitle');
    
    if (displayNameInput && cardTitle) {
        displayNameInput.addEventListener('input', (e) => {
            cardTitle.textContent = e.target.value || 'Your Business';
        });
    }
    
    // Initialize Google Places search for location input
    initializePlacesSearch();
    
    // Initialize business categories using external module if available
    if (typeof BusinessCategories !== 'undefined') {
        BusinessCategories.initialize();
    } else {
        // Fallback to internal initialization
        initializeBusinessCategories();
    }
    
    // Initialize promotion rules
    initializePromotionRules();
    
    // Show location on card checkbox - Enhanced to show address
    const showLocationCheckbox = document.getElementById('show-location');
    if (showLocationCheckbox && locationSubtitle) {
        showLocationCheckbox.addEventListener('change', (e) => {
            const locationInput = document.getElementById('location-name');
            if (e.target.checked && locationInput) {
                // Prefer stored address over name
                const address = locationInput.dataset.address || locationInput.value;
                if (address) {
                    locationSubtitle.textContent = address;
                    locationSubtitle.style.display = 'block';
                }
            } else {
                locationSubtitle.style.display = 'none';
            }
        });
    }
    
    // Background Image Upload
    const bgInput = document.getElementById('bg-input');
    const bgUploadArea = document.getElementById('bg-upload');
    const bgImagePreview = document.getElementById('bg-image-preview');
    const cardBg = document.getElementById('card-bg');
    const opacityControl = document.getElementById('opacity-control');
    const opacitySlider = document.getElementById('bg-opacity');
    const opacityValue = document.getElementById('opacity-value');
    
    if (bgUploadArea && bgInput) {
        bgUploadArea.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                bgInput.click();
            }
        });
        
        bgInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                console.log('Background image selected:', file.name, 'Type:', file.type, 'Size:', file.size);
                
                currentBgFile = file;
                
                if (opacityControl) {
                    opacityControl.style.display = 'block';
                }
                
                const opacity = opacitySlider ? opacitySlider.value / 100 : 0.7;
                await processAndShowPreview(file, opacity);
                
                bgUploadArea.classList.add('has-file');
                const svgElement = bgUploadArea.querySelector('svg');
                const spanElement = bgUploadArea.querySelector('span');
                const smallElement = bgUploadArea.querySelector('small');
                
                if (svgElement) {
                    svgElement.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>`;
                }
                if (spanElement) {
                    spanElement.textContent = 'Background uploaded';
                }
                if (smallElement) {
                    smallElement.textContent = 'Click to change';
                }
            }
        });
    }
    
    // Opacity slider handler
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', async (e) => {
            const opacity = e.target.value;
            opacityValue.textContent = `${opacity}%`;
            
            if (currentBgFile) {
                await processAndShowPreview(currentBgFile, opacity / 100);
            }
        });
    }
    
    // Background Color Picker
    const bgColorInput = document.getElementById('bg-color');
    if (bgColorInput && cardBg) {
        bgColorInput.addEventListener('input', (e) => {
            // Only update gradient if no image is shown
            if (!bgImagePreview || bgImagePreview.style.display === 'none') {
                cardBg.style.background = `linear-gradient(135deg, ${e.target.value} 0%, ${adjustColor(e.target.value, -20)} 100%)`;
            } else if (currentBgFile) {
                // Reprocess image with new color
                const opacity = opacitySlider ? opacitySlider.value / 100 : 0.7;
                processAndShowPreview(currentBgFile, opacity);
            }
        });
    }
    
    // Logo Upload
    const logoInput = document.getElementById('logo-input');
    const logoUploadArea = document.getElementById('logo-upload');
    const logoPreview = document.getElementById('logo-preview');
    
    if (logoUploadArea && logoInput) {
        logoUploadArea.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                logoInput.click();
            }
        });
        
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                console.log('Logo selected:', file.name, 'Size:', file.size);
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (logoPreview) {
                        logoPreview.src = e.target.result;
                        logoPreview.style.display = 'block';
                    }
                    
                    logoUploadArea.classList.add('has-file');
                    const svgElement = logoUploadArea.querySelector('svg');
                    const spanElement = logoUploadArea.querySelector('span');
                    const smallElement = logoUploadArea.querySelector('small');
                    
                    if (svgElement) {
                        svgElement.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>`;
                    }
                    if (spanElement) {
                        spanElement.textContent = 'Logo uploaded';
                    }
                    if (smallElement) {
                        smallElement.textContent = 'Click to change';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Stamps Required Dropdown
    const stampsSelect = document.getElementById('stamps-required');
    if (stampsSelect) {
        // Set initial stamps grid
        updateStampsGrid(parseInt(stampsSelect.value));
        
        stampsSelect.addEventListener('change', (e) => {
            const count = parseInt(e.target.value);
            updateStampsGrid(count);
        });
    }
    
    // Reward Text
    const rewardInput = document.getElementById('reward-text');
    const rewardPreview = document.getElementById('reward-text-preview');
    
    if (rewardInput && rewardPreview) {
        rewardInput.addEventListener('input', (e) => {
            rewardPreview.textContent = e.target.value || 'Free Item';
        });
    }
    
    // Create Card Button (for new cards only)
    const createBtn = document.getElementById('create-card-btn');
    if (createBtn) {
        createBtn.addEventListener('click', createNewCard);
    }
    
    // Setup form validation
    setupFormValidation();
}

/**
 * Initialize promotion rules functionality
 */
function initializePromotionRules() {
    const rulesInput = document.getElementById('promotion-rules');
    const charCount = document.getElementById('rules-char-count');
    const rulesIcon = document.getElementById('promotion-rules-icon');
    const tooltipText = document.getElementById('rules-tooltip-text');
    
    if (rulesInput && charCount) {
        // Character counter and preview update
        rulesInput.addEventListener('input', (e) => {
            const length = e.target.value.length;
            charCount.textContent = length;
            
            // Update preview
            if (length > 0) {
                if (rulesIcon) {
                    rulesIcon.style.display = 'flex';
                }
                if (tooltipText) {
                    tooltipText.textContent = e.target.value;
                }
            } else {
                if (rulesIcon) {
                    rulesIcon.style.display = 'none';
                }
            }
        });
    }
}

/**
 * Setup form validation behavior
 */
function setupFormValidation() {
    // Mark fields as touched on blur for validation styling
    const requiredInputs = document.querySelectorAll('input[required], select[required]');
    requiredInputs.forEach(input => {
        input.addEventListener('blur', function() {
            this.classList.add('touched');
        });
        
        // Also mark as touched on change for selects
        if (input.tagName === 'SELECT') {
            input.addEventListener('change', function() {
                if (this.value) {
                    this.classList.add('valid');
                    this.classList.remove('invalid');
                } else {
                    this.classList.add('invalid');
                    this.classList.remove('valid');
                }
            });
        }
    });
}

/**
 * Process and show preview of background image with opacity and color overlay
 */
async function processAndShowPreview(file, opacity = 0.7) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Fill with the selected background color first
            const bgColor = document.getElementById('bg-color')?.value || '#7c5ce6';
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the image with opacity on top
            ctx.globalAlpha = opacity;
            ctx.drawImage(img, 0, 0);
            
            // Get the processed image
            canvas.toBlob(function(blob) {
                processedBgBlob = blob; // Store the processed blob
                const processedUrl = URL.createObjectURL(blob);
                
                // Update the preview
                const bgImagePreview = document.getElementById('bg-image-preview');
                
                if (bgImagePreview) {
                    bgImagePreview.src = processedUrl;
                    bgImagePreview.style.display = 'block';
                    bgImagePreview.style.opacity = '1';
                }
            });
        };
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

/**
 * Upload image to Supabase storage
 */
async function uploadImage(file, bucket, restaurantId) {
    try {
        console.log(`Uploading to ${bucket}:`, file.name || 'processed-image', 'Size:', file.size);
        
        const timestamp = Date.now();
        const fileExt = file.name ? file.name.split('.').pop() : 'png';
        const fileName = `${restaurantId}_${timestamp}.${fileExt}`;
        const filePath = `${restaurantId}/${fileName}`;
        
        console.log('Upload path:', filePath);
        
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) {
            console.error('Upload error:', error);
            throw error;
        }
        
        console.log('Upload successful:', data);
        
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);
        
        console.log('Public URL:', publicUrl);
        return publicUrl;
        
    } catch (error) {
        console.error('Error in uploadImage:', error);
        throw error;
    }
}

/**
 * Initialize Google Places search for location input
 */
function initializePlacesSearch() {
    const locationInput = document.getElementById('location-name');
    if (!locationInput) return;
    
    // Create suggestions container if it doesn't exist
    if (!document.getElementById('location-suggestions')) {
        const container = document.createElement('div');
        container.id = 'location-suggestions';
        container.className = 'places-suggestions';
        container.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-top: 4px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        locationInput.parentElement.style.position = 'relative';
        locationInput.parentElement.appendChild(container);
    }
    
    // Generate session token
    placesAutocompleteSession = generateSessionToken();
    
    // Add input event listener with debouncing
    locationInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Clear previous timeout
        if (placesSearchTimeout) {
            clearTimeout(placesSearchTimeout);
        }
        
        // Hide suggestions if query is empty
        if (query.length === 0) {
            hidePlacesSuggestions();
            // Also update the preview
            const locationSubtitle = document.getElementById('location-subtitle');
            if (locationSubtitle) {
                locationSubtitle.textContent = '';
                locationSubtitle.style.display = 'none';
            }
            return;
        }
        
        // Update preview in real-time (before search)
        const locationSubtitle = document.getElementById('location-subtitle');
        const showLocationCheckbox = document.getElementById('show-location');
        if (locationSubtitle && showLocationCheckbox?.checked) {
            locationSubtitle.textContent = query;
            locationSubtitle.style.display = 'block';
        }
        
        // Only search if query is at least 2 characters
        if (query.length < 2) {
            return;
        }
        
        // Show loading state
        showLoadingState();
        
        // Debounce search at 500ms
        placesSearchTimeout = setTimeout(async () => {
            await searchPlaces(query);
        }, 500);
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#location-name') && !e.target.closest('#location-suggestions')) {
            hidePlacesSuggestions();
        }
    });
    
    // Show suggestions on focus if there's a value
    locationInput.addEventListener('focus', (e) => {
        if (e.target.value.trim().length >= 2) {
            const suggestions = document.getElementById('location-suggestions');
            if (suggestions && suggestions.children.length > 0) {
                suggestions.style.display = 'block';
            }
        }
    });
}

/**
 * Search for places using Google Places API v2
 */
async function searchPlaces(query) {
    try {
        console.log('Searching Google Places v2 for:', query);
        
        const response = await fetch('https://vjwdyyzjacjnlkvoxgcm.supabase.co/functions/v1/google-places-v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqd2R5eXpqYWNqbmxrdm94Z2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTQwNDIsImV4cCI6MjA3MzE5MDA0Mn0.DMMCV14UrQROORgMOxwSevYSxYJGOr38bkGK5rHnkGo'
            },
            body: JSON.stringify({
                query: query,
                sessionToken: placesAutocompleteSession
            })
        });
        
        if (!response.ok) {
            console.error('Places API error:', response.status);
            showNoResults();
            return;
        }
        
        const data = await response.json();
        console.log('Places found:', data.places?.length || 0);
        
        if (data.places && data.places.length > 0) {
            displayPlacesSuggestions(data.places);
        } else {
            showNoResults();
        }
        
    } catch (error) {
        console.error('Error searching places:', error);
        showNoResults();
    }
}

/**
 * Display place suggestions
 */
function displayPlacesSuggestions(places) {
    const container = document.getElementById('location-suggestions');
    if (!container) return;
    
    container.innerHTML = '';
    
    places.forEach(place => {
        const suggestion = document.createElement('div');
        suggestion.className = 'place-suggestion-item';
        suggestion.style.cssText = `
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 1px solid #f3f4f6;
            transition: background-color 0.2s;
        `;
        
        const name = place.displayName?.text || place.name || 'Unknown Location';
        const address = place.formattedAddress || place.shortFormattedAddress || '';
        const placeId = place.id || place.place_id || '';
        const location = place.location || {};
        
        suggestion.innerHTML = `
            <div style="font-weight: 500; color: #111827; margin-bottom: 4px;">
                📍 ${escapeHtml(name)}
            </div>
            ${address ? `<div style="font-size: 14px; color: #6b7280;">${escapeHtml(address)}</div>` : ''}
        `;
        
        suggestion.addEventListener('mouseenter', () => {
            suggestion.style.backgroundColor = '#f9fafb';
        });
        
        suggestion.addEventListener('mouseleave', () => {
            suggestion.style.backgroundColor = 'white';
        });
        
        suggestion.addEventListener('click', () => {
            selectPlace({
                name: name,
                address: address,
                placeId: placeId,
                latitude: location.latitude || location.lat,
                longitude: location.longitude || location.lng
            });
        });
        
        container.appendChild(suggestion);
    });
    
    container.style.display = 'block';
}

/**
 * Select a place from suggestions
 */
function selectPlace(place) {
    console.log('Selected place:', place);
    
    const locationInput = document.getElementById('location-name');
    const locationSubtitle = document.getElementById('location-subtitle');
    const showLocationCheckbox = document.getElementById('show-location');
    
    if (locationInput) {
        locationInput.value = place.name;
        
        // Store full place data in dataset
        locationInput.dataset.placeId = place.placeId || '';
        locationInput.dataset.address = place.address || '';
        locationInput.dataset.latitude = place.latitude || '';
        locationInput.dataset.longitude = place.longitude || '';
    }
    
    // Show address in subtitle if checkbox is checked
    if (locationSubtitle && showLocationCheckbox?.checked && place.address) {
        locationSubtitle.textContent = place.address;
        locationSubtitle.style.display = 'block';
    }
    
    hidePlacesSuggestions();
    placesAutocompleteSession = generateSessionToken();
}

/**
 * Show loading state in suggestions
 */
function showLoadingState() {
    const container = document.getElementById('location-suggestions');
    if (!container) return;
    
    container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #6b7280;">
            <div style="margin-bottom: 8px;">Searching...</div>
        </div>
    `;
    
    container.style.display = 'block';
}

/**
 * Show no results message
 */
function showNoResults() {
    const container = document.getElementById('location-suggestions');
    if (!container) return;
    
    container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #6b7280;">
            <div style="font-size: 24px; margin-bottom: 8px;">📍</div>
            <div>No locations found</div>
            <div style="font-size: 14px; margin-top: 4px;">Try a different search term</div>
        </div>
    `;
    
    container.style.display = 'block';
}

/**
 * Hide places suggestions
 */
function hidePlacesSuggestions() {
    const container = document.getElementById('location-suggestions');
    if (container) {
        container.style.display = 'none';
    }
}

/**
 * Generate session token for Places API
 */
function generateSessionToken() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get stored place data from location input
 */
function getStoredPlaceData() {
    const locationInput = document.getElementById('location-name');
    if (!locationInput) return null;
    
    return {
        name: locationInput.value,
        placeId: locationInput.dataset.placeId || null,
        address: locationInput.dataset.address || null,
        latitude: locationInput.dataset.latitude ? parseFloat(locationInput.dataset.latitude) : null,
        longitude: locationInput.dataset.longitude ? parseFloat(locationInput.dataset.longitude) : null
    };
}

/**
 * Initialize business category selectors - Fallback if external module not available
 */
function initializeBusinessCategories() {
    const businessTypeSelect = document.getElementById('business-type');
    const subtypesContainer = document.getElementById('business-subtypes-container');
    
    if (!businessTypeSelect || !subtypesContainer) return;
    
    // Handle business type change
    businessTypeSelect.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        
        if (!selectedType) {
            subtypesContainer.style.display = 'none';
            return;
        }
        
        // Show subtypes container
        subtypesContainer.style.display = 'block';
    });
}

/**
 * Get selected subtypes - Fallback method
 */
function getSelectedSubtypes() {
    if (typeof BusinessCategories !== 'undefined' && BusinessCategories.getSelectedSubtypes) {
        return BusinessCategories.getSelectedSubtypes();
    }
    
    // Fallback: get from DOM
    const tags = document.querySelectorAll('.subtype-tag');
    return Array.from(tags).map(tag => tag.dataset.subtype);
}

/**
 * Create a new loyalty card with validation
 */
async function createNewCard() {
    const createBtn = document.getElementById('create-card-btn');
    if (!createBtn) return;
    
    console.log('=== CREATE NEW CARD START ===');
    const originalContent = createBtn.innerHTML;
    
    // VALIDATION: Check all required fields
    const displayName = document.getElementById('display-name')?.value?.trim();
    const locationName = document.getElementById('location-name')?.value?.trim();
    const businessType = document.getElementById('business-type')?.value;
    const stampsRequired = document.getElementById('stamps-required')?.value;
    
    // Validate display name
    if (!displayName) {
        alert('Please enter your business display name');
        document.getElementById('display-name')?.focus();
        document.getElementById('display-name')?.classList.add('touched');
        return;
    }
    
    // Validate business type
    if (!businessType) {
        alert('Please select a business type');
        document.getElementById('business-type')?.focus();
        document.getElementById('business-type')?.classList.add('touched');
        return;
    }
    
    // Validate address/location
    if (!locationName) {
        alert('Please enter your business address');
        document.getElementById('location-name')?.focus();
        document.getElementById('location-name')?.classList.add('touched');
        return;
    }
    
    // Validate stamps (should always have a value, but just in case)
    if (!stampsRequired) {
        alert('Please select the number of stamps required');
        document.getElementById('stamps-required')?.focus();
        return;
    }
    
    // Show loading state
    createBtn.innerHTML = `
        <svg class="animate-spin" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
            <path d="M4 12a8 8 0 018-8v8z" fill="currentColor"></path>
        </svg>
        <span>Creating...</span>
    `;
    createBtn.disabled = true;
    
    try {
        // Check Supabase
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase not initialized');
        }
        
        // Get current user session
        console.log('Getting user session...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error('User error:', userError);
            throw new Error('Authentication error: ' + userError.message);
        }
        
        if (!user) {
            throw new Error('No authenticated user found');
        }
        console.log('User authenticated:', user.email);
        
        // Get restaurant ID
        const restaurantData = sessionStorage.getItem('restaurant');
        let restaurantId;
        
        if (restaurantData) {
            restaurantId = JSON.parse(restaurantData).id;
            console.log('Restaurant ID from session:', restaurantId);
        } else {
            console.log('Fetching restaurant from database...');
            const { data: restaurant, error: fetchError } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', user.id)
                .single();
            
            if (fetchError || !restaurant) {
                console.error('Restaurant fetch error:', fetchError);
                throw new Error('No restaurant found for this user');
            }
            restaurantId = restaurant.id;
            console.log('Restaurant ID from database:', restaurantId);
        }
        
        // Verify restaurant ID
        if (!restaurantId) {
            throw new Error('Restaurant ID is missing!');
        }
        
        // Get place data from the location input
        const placeData = getStoredPlaceData();
        console.log('Place data:', placeData);
        
        // Get business categories
        const businessSubtypes = getSelectedSubtypes();
        console.log('Business type:', businessType, 'Subtypes:', businessSubtypes);
        
        // Prepare card data with validated fields including promotion rules
        const cardData = {
            restaurant_id: restaurantId,
            display_name: displayName,
            location_name: placeData?.name || locationName,
            location_address: placeData?.address || locationName,
            location_place_id: placeData?.placeId || null,
            location_latitude: placeData?.latitude || null,
            location_longitude: placeData?.longitude || null,
            show_location_on_card: document.getElementById('show-location')?.checked || false,
            stamps_required: parseInt(stampsRequired),
            reward_text: document.getElementById('reward-text').value || 'Free Item',
            promotion_rules: document.getElementById('promotion-rules')?.value || null,  // Added promotion rules
            card_color: document.getElementById('bg-color').value,
            text_color: '#FFFFFF',
            business_type: businessType,
            business_subtypes: businessSubtypes,
            is_active: false,
            campaign_status: 'draft'
        };
        
        console.log('Card data prepared:', cardData);
        
        // Handle background image - upload the processed blob with transparency
        const bgInput = document.getElementById('bg-input');
        if (bgInput && bgInput.files && bgInput.files[0] && processedBgBlob) {
            console.log('Processed background blob found, uploading...');
            try {
                const bgUrl = await uploadImage(processedBgBlob, 'card-backgrounds', restaurantId);
                console.log('Background URL returned:', bgUrl);
                cardData.background_image_url = bgUrl;
            } catch (uploadError) {
                console.error('Background upload failed:', uploadError);
                throw new Error('Failed to upload background image: ' + uploadError.message);
            }
        }
        
        // Handle logo
        const logoInput = document.getElementById('logo-input');
        if (logoInput && logoInput.files && logoInput.files[0]) {
            console.log('Logo file found:', logoInput.files[0]);
            try {
                const logoUrl = await uploadImage(logoInput.files[0], 'restaurant-logos', restaurantId);
                console.log('Logo URL returned:', logoUrl);
                cardData.logo_url = logoUrl;
            } catch (uploadError) {
                console.error('Logo upload failed:', uploadError);
                throw new Error('Failed to upload logo: ' + uploadError.message);
            }
        }
        
        // Create new card
        console.log('Creating new card in database...');
        const { data: newCard, error: saveError } = await supabase
            .from('loyalty_cards')
            .insert([cardData])
            .select()
            .single();
        
        if (saveError) {
            console.error('Database save error:', saveError);
            throw saveError;
        }
        
        console.log('New card created successfully:', newCard);
        
        // Show success modal
        showSuccessModal();
        
        // Reset button
        createBtn.innerHTML = originalContent;
        createBtn.disabled = false;
        
        console.log('=== CREATE NEW CARD COMPLETE ===');
        
    } catch (error) {
        console.error('=== CREATE NEW CARD ERROR ===');
        console.error('Error:', error);
        createBtn.innerHTML = originalContent;
        createBtn.disabled = false;
        alert('Error creating card: ' + error.message);
    }
}

/**
 * Update stamps grid based on count
 */
function updateStampsGrid(count) {
    const stampsGrid = document.getElementById('stamps-preview');
    if (!stampsGrid) return;
    
    stampsGrid.innerHTML = '';
    stampsGrid.setAttribute('data-count', count);
    
    // Create stamps with 3 filled for preview
    for (let i = 0; i < count; i++) {
        const stamp = document.createElement('div');
        stamp.className = i < 3 ? 'stamp filled' : 'stamp';
        stamp.innerHTML = i < 3 ? '✓' : '';
        stampsGrid.appendChild(stamp);
    }
}

/**
 * Show success modal after card creation
 */
function showSuccessModal() {
    console.log('showSuccessModal called');
    
    const modal = document.getElementById('success-modal');
    if (!modal) {
        console.error('Success modal not found');
        return;
    }
    
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.zIndex = '99999';
    
    setTimeout(() => {
        const createAnotherBtn = document.getElementById('create-another-btn');
        const goToMyCardsBtn = document.getElementById('go-to-my-cards-btn');
        
        if (createAnotherBtn) {
            createAnotherBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Create another clicked');
                window.closeSuccessModal();
            };
        }
        
        if (goToMyCardsBtn) {
            goToMyCardsBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Go to my cards clicked');
                window.goToMyCards();
            };
        }
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                console.log('Backdrop clicked');
                window.closeSuccessModal();
            }
        };
    }, 100);
    
    document.body.style.overflow = 'hidden';
    
    console.log('Success modal should be visible now');
}

/**
 * Helper function to adjust color brightness
 */
function adjustColor(color, amount) {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return (usePound ? '#' : '') + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * Load existing card design for editing
 */
function loadCardForEditing(design) {
    // Set display name
    if (design.display_name) {
        const displayNameInput = document.getElementById('display-name');
        const titlePreview = document.getElementById('title-preview');
        if (displayNameInput) displayNameInput.value = design.display_name;
        if (titlePreview) titlePreview.textContent = design.display_name;
    }
    
    // Set business type
    if (design.business_type) {
        const businessTypeSelect = document.getElementById('business-type');
        if (businessTypeSelect) {
            businessTypeSelect.value = design.business_type;
            businessTypeSelect.dispatchEvent(new Event('change'));
            
            // Load selected subtypes after a small delay
            if (typeof BusinessCategories !== 'undefined' && design.business_subtypes) {
                setTimeout(() => {
                    BusinessCategories.setSelectedSubtypes(design.business_subtypes);
                }, 100);
            }
        }
    }
    
    // Set location with Places API data
    if (design.location_name) {
        const locationInput = document.getElementById('location-name');
        const locationSubtitle = document.getElementById('location-subtitle');
        const showLocationCheckbox = document.getElementById('show-location');
        
        if (locationInput) {
            locationInput.value = design.location_name;
            
            // Restore Places API data if available
            if (design.location_place_id) locationInput.dataset.placeId = design.location_place_id;
            if (design.location_address) locationInput.dataset.address = design.location_address;
            if (design.location_latitude) locationInput.dataset.latitude = design.location_latitude;
            if (design.location_longitude) locationInput.dataset.longitude = design.location_longitude;
        }
        
        if (showLocationCheckbox) showLocationCheckbox.checked = design.show_location_on_card || false;
        if (locationSubtitle && design.show_location_on_card && design.location_address) {
            locationSubtitle.textContent = design.location_address;
            locationSubtitle.style.display = 'block';
        }
    }
    
    // Set promotion rules
    if (design.promotion_rules) {
        const rulesInput = document.getElementById('promotion-rules');
        const rulesIcon = document.getElementById('promotion-rules-icon');
        const tooltipText = document.getElementById('rules-tooltip-text');
        const charCount = document.getElementById('rules-char-count');
        
        if (rulesInput) {
            rulesInput.value = design.promotion_rules;
        }
        if (charCount) {
            charCount.textContent = design.promotion_rules.length;
        }
        if (rulesIcon && design.promotion_rules.length > 0) {
            rulesIcon.style.display = 'flex';
        }
        if (tooltipText) {
            tooltipText.textContent = design.promotion_rules;
        }
    }
    
    // Set background
    if (design.background_image_url) {
        const bgImagePreview = document.getElementById('bg-image-preview');
        if (bgImagePreview) {
            bgImagePreview.src = design.background_image_url;
            bgImagePreview.style.display = 'block';
        }
        const opacityControl = document.getElementById('opacity-control');
        if (opacityControl) {
            opacityControl.style.display = 'block';
        }
    } else if (design.card_color) {
        const bgColorInput = document.getElementById('bg-color');
        const cardBg = document.getElementById('card-bg');
        if (bgColorInput) bgColorInput.value = design.card_color;
        if (cardBg) {
            cardBg.style.background = `linear-gradient(135deg, ${design.card_color} 0%, ${adjustColor(design.card_color, -20)} 100%)`;
        }
    }
    
    // Set logo
    if (design.logo_url) {
        const logoPreview = document.getElementById('logo-preview');
        if (logoPreview) {
            logoPreview.src = design.logo_url;
            logoPreview.style.display = 'block';
        }
    }
    
    // Set stamps
    if (design.stamps_required) {
        const stampsSelect = document.getElementById('stamps-required');
        if (stampsSelect) {
            stampsSelect.value = design.stamps_required;
        }
        updateStampsGrid(design.stamps_required);
    }
    
    // Set reward
    if (design.reward_text) {
        const rewardInput = document.getElementById('reward-text');
        const rewardPreview = document.getElementById('reward-text-preview');
        if (rewardInput) rewardInput.value = design.reward_text;
        if (rewardPreview) rewardPreview.textContent = design.reward_text;
    }
    
    // Change button text and handler for edit mode
    const createBtn = document.getElementById('create-card-btn');
    if (createBtn) {
        createBtn.innerHTML = `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2"/>
            </svg>
            Update Card
        `;
        createBtn.replaceWith(createBtn.cloneNode(true));
        const newBtn = document.getElementById('create-card-btn');
        newBtn.addEventListener('click', () => updateCardDesign(design.id));
    }
}

/**
 * Update existing card design (for edit mode)
 */
async function updateCardDesign(cardId) {
    console.log('=== UPDATE CARD DESIGN START ===');
    console.log('Updating card ID:', cardId);
    
    try {
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase not initialized');
        }
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            throw new Error('Authentication error');
        }
        
        const placeData = getStoredPlaceData();
        const businessType = document.getElementById('business-type')?.value;
        const businessSubtypes = getSelectedSubtypes();
        
        const cardData = {
            display_name: document.getElementById('display-name').value || 'Your Restaurant',
            location_name: placeData?.name || document.getElementById('location-name')?.value || '',
            location_address: placeData?.address || null,
            location_place_id: placeData?.placeId || null,
            location_latitude: placeData?.latitude || null,
            location_longitude: placeData?.longitude || null,
            show_location_on_card: document.getElementById('show-location')?.checked || false,
            stamps_required: parseInt(document.getElementById('stamps-required').value),
            reward_text: document.getElementById('reward-text').value || 'Free Item',
            promotion_rules: document.getElementById('promotion-rules')?.value || null,  // Added promotion rules
            card_color: document.getElementById('bg-color').value,
            business_type: businessType,
            business_subtypes: businessSubtypes,
            updated_at: new Date().toISOString()
        };
        
        // Handle background image if changed - upload processed blob
        const bgInput = document.getElementById('bg-input');
        if (bgInput && bgInput.files && bgInput.files[0] && processedBgBlob) {
            console.log('Uploading new processed background...');
            const restaurantId = (await supabase
                .from('loyalty_cards')
                .select('restaurant_id')
                .eq('id', cardId)
                .single()).data.restaurant_id;
                
            const bgUrl = await uploadImage(processedBgBlob, 'card-backgrounds', restaurantId);
            cardData.background_image_url = bgUrl;
        }
        
        // Handle logo if changed
        const logoInput = document.getElementById('logo-input');
        if (logoInput && logoInput.files && logoInput.files[0]) {
            console.log('Uploading new logo...');
            const restaurantId = (await supabase
                .from('loyalty_cards')
                .select('restaurant_id')
                .eq('id', cardId)
                .single()).data.restaurant_id;
                
            const logoUrl = await uploadImage(logoInput.files[0], 'restaurant-logos', restaurantId);
            cardData.logo_url = logoUrl;
        }
        
        const { error: updateError } = await supabase
            .from('loyalty_cards')
            .update(cardData)
            .eq('id', cardId);
        
        if (updateError) {
            throw updateError;
        }
        
        console.log('Card updated successfully');
        alert('Card updated successfully!');
        
        document.querySelector('[data-section="my-cards"]')?.click();
        
    } catch (error) {
        console.error('=== UPDATE CARD DESIGN ERROR ===');
        console.error('Error:', error);
        alert('Error updating card: ' + error.message);
    }
}

// Global functions for success modal
window.closeSuccessModal = function() {
    const modal = document.getElementById('success-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        
        // Reset the form
        resetCardForm();
    }
};

window.goToMyCards = function() {
    const modal = document.getElementById('success-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    const myCardsBtn = document.querySelector('[data-section="my-cards"]');
    if (myCardsBtn) {
        myCardsBtn.click();
    }
};

/**
 * Reset the card creation form
 */
function resetCardForm() {
    // Reset all form inputs
    document.getElementById('display-name').value = '';
    document.getElementById('business-type').value = '';
    document.getElementById('location-name').value = '';
    document.getElementById('show-location').checked = false;
    document.getElementById('stamps-required').value = '10';
    document.getElementById('reward-text').value = 'Free Item';
    document.getElementById('promotion-rules').value = '';  // Reset promotion rules
    document.getElementById('bg-color').value = '#7c5ce6';
    
    // Clear location dataset
    const locationInput = document.getElementById('location-name');
    if (locationInput) {
        delete locationInput.dataset.placeId;
        delete locationInput.dataset.address;
        delete locationInput.dataset.latitude;
        delete locationInput.dataset.longitude;
    }
    
    // Clear file inputs
    document.getElementById('bg-input').value = '';
    document.getElementById('logo-input').value = '';
    
    // Clear processed blobs
    currentBgFile = null;
    processedBgBlob = null;
    
    // Reset previews
    document.getElementById('title-preview').textContent = 'Your Business';
    document.getElementById('location-subtitle').style.display = 'none';
    document.getElementById('location-subtitle').textContent = '';
    document.getElementById('reward-text-preview').textContent = 'Free Item';
    
    // Reset promotion rules preview
    document.getElementById('rules-char-count').textContent = '0';
    document.getElementById('promotion-rules-icon').style.display = 'none';
    
    // Hide background image preview
    const bgImagePreview = document.getElementById('bg-image-preview');
    if (bgImagePreview) {
        bgImagePreview.style.display = 'none';
    }
    
    // Reset background to default color
    const cardBg = document.getElementById('card-bg');
    if (cardBg) {
        cardBg.style.background = 'linear-gradient(135deg, #7c5ce6 0%, #6c63ff 100%)';
    }
    
    // Reset stamps grid
    updateStampsGrid(10);
    
    // Clear subtypes
    if (typeof BusinessCategories !== 'undefined' && BusinessCategories.clearSelectedSubtypes) {
        BusinessCategories.clearSelectedSubtypes();
    }
    document.getElementById('business-subtypes-container').style.display = 'none';
    
    // Hide opacity control
    const opacityControl = document.getElementById('opacity-control');
    if (opacityControl) {
        opacityControl.style.display = 'none';
    }
    
    // Reset validation classes
    const allInputs = document.querySelectorAll('input, select');
    allInputs.forEach(input => {
        input.classList.remove('touched', 'valid', 'invalid');
    });
}

// Export functions for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeCardDesigner,
        createNewCard,
        updateCardDesign,
        loadCardForEditing,
        updateStampsGrid,
        adjustColor,
        showSuccessModal,
        resetCardForm
    };
}