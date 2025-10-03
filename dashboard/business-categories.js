// business-categories.js - Business category management module

// Business categories configuration
const businessCategories = {
    'food_beverage': {
        label: 'Food & Beverage',
        subtypes: [
            'italian', 'pizza', 'burger', 'sushi', 'asian', 'chinese', 'japanese', 'korean',
            'mexican', 'indian', 'mediterranean', 'greek', 'spanish', 'french',
            'vegan', 'vegetarian', 'gluten_free', 'healthy', 'organic',
            'bakery', 'pastry', 'ice_cream', 'frozen_yogurt', 'juice_bar',
            'coffee', 'tea', 'bubble_tea', 'bar', 'pub', 'brewery', 'wine_bar',
            'fast_food', 'casual_dining', 'fine_dining', 'buffet', 'food_truck',
            'breakfast', 'brunch', 'lunch', 'dinner', 'late_night',
            'seafood', 'steakhouse', 'bbq', 'grill', 'tapas', 'desserts', 'sweets'
        ]
    },
    'beauty_wellness': {
        label: 'Beauty & Wellness',
        subtypes: [
            'hair_salon', 'barber', 'nail_salon', 'spa', 'massage', 'facial',
            'lashes', 'eyebrows', 'makeup', 'permanent_makeup', 'microblading',
            'skin_care', 'dermatology', 'waxing', 'threading', 'sugaring',
            'tanning', 'spray_tan', 'aesthetics', 'botox', 'fillers',
            'cosmetics', 'beauty_products', 'perfume',
            'tattoo', 'piercing', 'body_art',
            'wellness_center', 'meditation', 'holistic', 'aromatherapy'
        ]
    },
    'fitness_sports': {
        label: 'Fitness & Sports',
        subtypes: [
            'gym', 'fitness_center', 'health_club',
            'yoga', 'hot_yoga', 'pilates', 'barre',
            'crossfit', 'f45', 'orange_theory', 'bootcamp',
            'boxing', 'kickboxing', 'mma', 'martial_arts', 'karate', 'judo',
            'dance', 'zumba', 'ballet', 'hip_hop',
            'swimming', 'aqua_fitness', 'tennis', 'squash', 'badminton',
            'golf', 'driving_range', 'mini_golf',
            'personal_training', 'group_classes', 'spin', 'cycling',
            'running', 'athletics', 'sports_club', 'recreation_center',
            'climbing', 'bouldering', 'trampoline', 'parkour'
        ]
    },
    'retail': {
        label: 'Retail & Shopping',
        subtypes: [
            'clothing', 'mens_fashion', 'womens_fashion', 'kids_clothing',
            'shoes', 'sneakers', 'accessories', 'bags', 'jewelry', 'watches',
            'electronics', 'mobile_phones', 'computers', 'gaming',
            'books', 'stationery', 'art_supplies', 'crafts',
            'gifts', 'souvenirs', 'cards', 'party_supplies',
            'home_decor', 'furniture', 'kitchen', 'bedding', 'lighting',
            'toys', 'games', 'hobbies', 'collectibles',
            'sports_equipment', 'outdoor_gear', 'camping',
            'pet_supplies', 'pet_grooming', 'pet_food',
            'pharmacy', 'health_products', 'vitamins',
            'convenience', 'supermarket', 'grocery', 'organic_market',
            'department_store', 'outlet', 'thrift_shop', 'vintage'
        ]
    },
    'automotive': {
        label: 'Automotive',
        subtypes: [
            'car_wash', 'hand_wash', 'auto_detailing', 'ceramic_coating',
            'mechanic', 'auto_repair', 'oil_change', 'tire_service',
            'body_shop', 'paint_shop', 'dent_repair',
            'parts_store', 'accessories', 'customization',
            'car_rental', 'car_sharing', 'dealership', 'used_cars',
            'motorcycle', 'scooter', 'bicycle', 'ebike',
            'gas_station', 'charging_station', 'parking'
        ]
    },
    'health_medical': {
        label: 'Health & Medical',
        subtypes: [
            'clinic', 'medical_center', 'hospital', 'urgent_care',
            'dental', 'orthodontics', 'oral_surgery',
            'optometry', 'ophthalmology', 'glasses', 'contacts',
            'physiotherapy', 'rehabilitation', 'sports_medicine',
            'chiropractic', 'osteopathy', 'acupuncture',
            'psychology', 'psychiatry', 'counseling', 'therapy',
            'nutrition', 'dietitian', 'weight_loss',
            'alternative_medicine', 'naturopathy', 'homeopathy',
            'veterinary', 'animal_hospital', 'pet_clinic',
            'pharmacy', 'compounding', 'medical_supplies',
            'laboratory', 'imaging', 'xray', 'ultrasound',
            'medical_spa', 'IV_therapy', 'cryotherapy'
        ]
    },
    'services': {
        label: 'Professional Services',
        subtypes: [
            'dry_cleaning', 'laundry', 'alterations', 'tailoring',
            'shoe_repair', 'cobbler', 'key_cutting', 'locksmith',
            'photography', 'videography', 'photo_printing',
            'printing', 'copying', 'shipping', 'packaging',
            'travel_agency', 'tour_operator', 'luggage',
            'real_estate', 'property_management', 'moving',
            'insurance', 'financial_advisor', 'accountant', 'tax_service',
            'legal', 'notary', 'translation',
            'education', 'tutoring', 'test_prep', 'language_school',
            'computer_repair', 'phone_repair', 'tech_support',
            'cleaning', 'maid_service', 'carpet_cleaning',
            'pest_control', 'landscaping', 'pool_service'
        ]
    },
    'entertainment': {
        label: 'Entertainment & Leisure',
        subtypes: [
            'cinema', 'movie_theater', 'drive_in',
            'theater', 'comedy_club', 'magic_show',
            'arcade', 'vr_experience', 'laser_tag', 'paintball',
            'bowling', 'billiards', 'darts', 'mini_golf',
            'escape_room', 'mystery_room', 'puzzle_room',
            'karaoke', 'nightclub', 'lounge', 'hookah',
            'live_music', 'concert_venue', 'jazz_club',
            'museum', 'art_gallery', 'exhibition',
            'amusement_park', 'theme_park', 'water_park',
            'zoo', 'aquarium', 'safari', 'petting_zoo',
            'casino', 'betting', 'bingo',
            'kids_play', 'indoor_playground', 'trampoline_park'
        ]
    }
};

// Subtype labels for display
const subtypeLabels = {
    // Food & Beverage
    'italian': 'Italian',
    'pizza': 'Pizza',
    'burger': 'Burgers',
    'sushi': 'Sushi',
    'asian': 'Asian',
    'chinese': 'Chinese',
    'japanese': 'Japanese',
    'korean': 'Korean',
    'mexican': 'Mexican',
    'indian': 'Indian',
    'mediterranean': 'Mediterranean',
    'greek': 'Greek',
    'spanish': 'Spanish',
    'french': 'French',
    'vegan': 'Vegan',
    'vegetarian': 'Vegetarian',
    'gluten_free': 'Gluten-Free',
    'healthy': 'Healthy',
    'organic': 'Organic',
    'bakery': 'Bakery',
    'pastry': 'Pastry',
    'ice_cream': 'Ice Cream',
    'frozen_yogurt': 'Frozen Yogurt',
    'juice_bar': 'Juice Bar',
    'coffee': 'Coffee Shop',
    'tea': 'Tea House',
    'bubble_tea': 'Bubble Tea',
    'bar': 'Bar',
    'pub': 'Pub',
    'brewery': 'Brewery',
    'wine_bar': 'Wine Bar',
    'fast_food': 'Fast Food',
    'casual_dining': 'Casual Dining',
    'fine_dining': 'Fine Dining',
    'buffet': 'Buffet',
    'food_truck': 'Food Truck',
    'breakfast': 'Breakfast',
    'brunch': 'Brunch',
    'lunch': 'Lunch',
    'dinner': 'Dinner',
    'late_night': 'Late Night',
    'seafood': 'Seafood',
    'steakhouse': 'Steakhouse',
    'bbq': 'BBQ',
    'grill': 'Grill',
    'tapas': 'Tapas',
    'desserts': 'Desserts',
    'sweets': 'Sweets',
    
    // Beauty & Wellness
    'hair_salon': 'Hair Salon',
    'barber': 'Barber Shop',
    'nail_salon': 'Nail Salon',
    'spa': 'Spa',
    'massage': 'Massage',
    'facial': 'Facial',
    'lashes': 'Lash Extensions',
    'eyebrows': 'Eyebrow Services',
    'makeup': 'Makeup',
    'permanent_makeup': 'Permanent Makeup',
    'microblading': 'Microblading',
    'skin_care': 'Skin Care',
    'dermatology': 'Dermatology',
    'waxing': 'Waxing',
    'threading': 'Threading',
    'sugaring': 'Sugaring',
    'tanning': 'Tanning',
    'spray_tan': 'Spray Tan',
    'aesthetics': 'Aesthetics',
    'botox': 'Botox',
    'fillers': 'Fillers',
    'cosmetics': 'Cosmetics',
    'beauty_products': 'Beauty Products',
    'perfume': 'Perfume',
    'tattoo': 'Tattoo',
    'piercing': 'Piercing',
    'body_art': 'Body Art',
    'wellness_center': 'Wellness Center',
    'meditation': 'Meditation',
    'holistic': 'Holistic Health',
    'aromatherapy': 'Aromatherapy',
    
    // Fitness & Sports
    'gym': 'Gym',
    'fitness_center': 'Fitness Center',
    'health_club': 'Health Club',
    'yoga': 'Yoga Studio',
    'hot_yoga': 'Hot Yoga',
    'pilates': 'Pilates',
    'barre': 'Barre',
    'crossfit': 'CrossFit',
    'f45': 'F45',
    'orange_theory': 'Orange Theory',
    'bootcamp': 'Bootcamp',
    'boxing': 'Boxing',
    'kickboxing': 'Kickboxing',
    'mma': 'MMA',
    'martial_arts': 'Martial Arts',
    'karate': 'Karate',
    'judo': 'Judo',
    'dance': 'Dance Studio',
    'zumba': 'Zumba',
    'ballet': 'Ballet',
    'hip_hop': 'Hip Hop',
    'swimming': 'Swimming',
    'aqua_fitness': 'Aqua Fitness',
    'tennis': 'Tennis',
    'squash': 'Squash',
    'badminton': 'Badminton',
    'golf': 'Golf',
    'driving_range': 'Driving Range',
    'mini_golf': 'Mini Golf',
    'personal_training': 'Personal Training',
    'group_classes': 'Group Classes',
    'spin': 'Spin',
    'cycling': 'Cycling',
    'running': 'Running Club',
    'athletics': 'Athletics',
    'sports_club': 'Sports Club',
    'recreation_center': 'Recreation Center',
    'climbing': 'Climbing',
    'bouldering': 'Bouldering',
    'trampoline': 'Trampoline',
    'parkour': 'Parkour',
    
    // Add more labels as needed...
};

/**
 * Initialize business category selectors
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
            clearSelectedSubtypes();
            return;
        }
        
        // Clear previous selections when changing main category
        clearSelectedSubtypes();
        
        // Show subtypes container
        subtypesContainer.style.display = 'block';
        
        // Load subtypes for selected category
        const category = businessCategories[selectedType];
        if (category) {
            loadSubtypes(category.subtypes);
        }
    });
    
    // Handle dropdown toggle
    const multiSelectInput = document.querySelector('.multi-select-input');
    const dropdown = document.getElementById('subtype-dropdown');
    
    if (multiSelectInput && dropdown) {
        multiSelectInput.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.multi-select-wrapper')) {
                dropdown.style.display = 'none';
            }
        });
    }
}

/**
 * Load subtypes into the multi-select dropdown
 */
function loadSubtypes(subtypes) {
    const dropdown = document.getElementById('subtype-dropdown');
    
    if (!dropdown) return;
    
    // Clear existing options
    dropdown.innerHTML = '';
    
    // Add search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'subtype-search';
    searchInput.placeholder = 'Search tags...';
    searchInput.onclick = (e) => e.stopPropagation();
    
    dropdown.appendChild(searchInput);
    
    // Create options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'subtype-options';
    
    // Add options
    subtypes.forEach(subtype => {
        const option = document.createElement('div');
        option.className = 'subtype-option';
        option.dataset.value = subtype;
        option.dataset.label = (subtypeLabels[subtype] || subtype).toLowerCase();
        option.innerHTML = `
            <input type="checkbox" id="subtype-${subtype}" value="${subtype}">
            <label for="subtype-${subtype}">${subtypeLabels[subtype] || subtype}</label>
        `;
        
        // Handle selection
        const checkbox = option.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                addSubtypeTag(subtype);
            } else {
                removeSubtypeTag(subtype);
            }
            updatePlaceholder();
        });
        
        optionsContainer.appendChild(option);
    });
    
    dropdown.appendChild(optionsContainer);
    
    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const options = optionsContainer.querySelectorAll('.subtype-option');
        
        options.forEach(option => {
            const label = option.dataset.label;
            option.style.display = label.includes(searchTerm) ? 'flex' : 'none';
        });
    });
}

/**
 * Add subtype tag
 */
function addSubtypeTag(subtype) {
    const container = document.getElementById('selected-subtypes');
    if (!container) return;
    
    // Check if already added
    if (container.querySelector(`[data-subtype="${subtype}"]`)) return;
    
    const tag = document.createElement('span');
    tag.className = 'subtype-tag';
    tag.dataset.subtype = subtype;
    tag.innerHTML = `
        ${subtypeLabels[subtype] || subtype}
        <button type="button" class="remove-tag" data-subtype="${subtype}">&times;</button>
    `;
    
    // Add event listener to remove button
    tag.querySelector('.remove-tag').addEventListener('click', (e) => {
        e.stopPropagation();
        removeSubtypeTag(subtype);
    });
    
    container.appendChild(tag);
}

/**
 * Remove subtype tag
 */
function removeSubtypeTag(subtype) {
    // Remove tag
    const tag = document.querySelector(`[data-subtype="${subtype}"]`);
    if (tag) tag.remove();
    
    // Uncheck checkbox
    const checkbox = document.getElementById(`subtype-${subtype}`);
    if (checkbox) checkbox.checked = false;
    
    updatePlaceholder();
}

/**
 * Clear all selected subtypes
 */
function clearSelectedSubtypes() {
    const container = document.getElementById('selected-subtypes');
    if (container) {
        container.innerHTML = '';
    }
    
    // Uncheck all checkboxes
    document.querySelectorAll('.subtype-option input').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    updatePlaceholder();
}

/**
 * Update placeholder text
 */
function updatePlaceholder() {
    const container = document.getElementById('selected-subtypes');
    const tags = container?.querySelectorAll('.subtype-tag');
    
    if (!tags || tags.length === 0) {
        if (container && !container.querySelector('.placeholder')) {
            container.innerHTML = '<span class="placeholder">Click to select tags...</span>';
        }
    } else {
        const placeholder = container?.querySelector('.placeholder');
        if (placeholder) {
            placeholder.remove();
        }
    }
}

/**
 * Get selected subtypes
 */
function getSelectedSubtypes() {
    const tags = document.querySelectorAll('.subtype-tag');
    return Array.from(tags).map(tag => tag.dataset.subtype);
}

// Export for use in other modules
window.BusinessCategories = {
    categories: businessCategories,
    labels: subtypeLabels,
    initialize: initializeBusinessCategories,
    loadSubtypes: loadSubtypes,
    addSubtypeTag: addSubtypeTag,
    removeSubtypeTag: removeSubtypeTag,
    clearSelectedSubtypes: clearSelectedSubtypes,
    updatePlaceholder: updatePlaceholder,
    getSelectedSubtypes: getSelectedSubtypes
};