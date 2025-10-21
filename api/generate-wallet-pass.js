const { PKPass } = require("passkit-generator");
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Create a simple 1x1 pixel transparent PNG as placeholder
const createPlaceholderIcon = () => {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
};

module.exports = async (req, res) => {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Card ID required' });
  }

  try {
    const { data: card, error } = await supabase
      .from('customer_cards')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Build auxiliary fields only if promotion_rules exists
    const auxiliaryFields = [];
    if (card.promotion_rules) {
      auxiliaryFields.push({
        key: "rules",
        label: "HOW IT WORKS",
        value: card.promotion_rules
      });
    }

    // Build back fields
    const backFields = [{
      key: "disclaimer",
      label: "IMPORTANT",
      value: "Use this card to collect stamps. Navigate to the Loyaly app to see your current stamp count and redeem rewards."
    },
    {
      key: "business",
      label: "BUSINESS",
      value: card.display_name
    },
    {
      key: "rewardDetails",
      label: "REWARD",
      value: card.reward_text
    }];

    // Add promotion rules to back only if they exist
    if (card.promotion_rules) {
      backFields.push({
        key: "promotionRules",
        label: "PROMOTION RULES",
        value: card.promotion_rules
      });
    }

    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: "pass.eu.loyaly.loyaly",
      serialNumber: String(card.card_number),
      teamIdentifier: "8U9RFQ4C56",
      organizationName: card.display_name,
      description: `${card.display_name} Loyaly Card`,
      foregroundColor: card.text_color || "#FFFFFF",
      backgroundColor: card.card_color || "#7c5ce6",
      
      barcodes: [{
        format: "PKBarcodeFormatQR",
        message: card.id,
        messageEncoding: "iso-8859-1"
      }],
      
      storeCard: {
        headerFields: [{
          key: "businessName",
          label: "LOYALY CARD",
          value: card.display_name
        }],
        primaryFields: [{
          key: "cardNumber",
          label: "CARD NUMBER",
          value: `#${card.card_number}`
        }],
        secondaryFields: [{
          key: "reward",
          label: "REWARD",
          value: card.reward_text
        },
        {
          key: "howTo",
          label: "HOW IT WORKS",
          value: "Use pass to collect stamps. Check app for status and redeem."
        }],
        auxiliaryFields: auxiliaryFields,
        backFields: backFields
      }
    };

    // Create pass with icon files
    const pass = new PKPass(
      {
        "pass.json": Buffer.from(JSON.stringify(passJson)),
        "icon.png": createPlaceholderIcon(),
        "icon@2x.png": createPlaceholderIcon(),
        "icon@3x.png": createPlaceholderIcon()
      },
      {
        wwdr: Buffer.from(process.env.APPLE_WWDR_CERT, 'base64').toString(),
        signerCert: Buffer.from(process.env.APPLE_SIGNER_CERT, 'base64').toString(),
        signerKey: Buffer.from(process.env.APPLE_SIGNER_KEY, 'base64').toString()
      }
    );

    const buffer = pass.getAsBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="loyaly-${card.card_number}.pkpass"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Pass generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate pass', 
      details: error.message
    });
  }
};
