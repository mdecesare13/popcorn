// validation.js
const validatePartyId = (req, res, next) => {
    const { partyId } = req.params;
    
    // Check if partyId exists and validate UUID format
    if (partyId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(partyId)) {
            return res.status(400).json({ error: 'Invalid Party ID format' });
        }
    }

    next();
};

const validatePartyCreation = (req, res, next) => {
    const { host_name, streaming_services } = req.body;
    const errors = [];

    if (!host_name) {
        errors.push('Host name is required');
    }

    if (!streaming_services || !Array.isArray(streaming_services) || streaming_services.length === 0) {
        errors.push('At least one streaming service is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
};

const validateJoinParty = (req, res, next) => {
    const { user_name } = req.body;
    
    if (!user_name) {
        return res.status(400).json({ error: 'User name is required' });
    }

    next();
};

const validateRating = (req, res, next) => {
    const { user_id, movie_id, rating } = req.body;
    const errors = [];

    if (!user_id) errors.push('User ID is required');
    if (!movie_id) errors.push('Movie ID is required');
    if (typeof rating !== 'number' || rating < 1 || rating > 10) {
        errors.push('Rating must be a number between 1 and 10');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
};

const validateVote = (req, res, next) => {
    const { user_id, movie_id, vote } = req.body;
    const errors = [];

    if (!user_id) errors.push('User ID is required');
    if (!movie_id) errors.push('Movie ID is required');
    if (!vote || !['yes', 'no', 'seen'].includes(vote)) {
        errors.push('Vote must be either "yes", "no", or "seen"');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
};

module.exports = {
    validatePartyId,
    validatePartyCreation,
    validateJoinParty,
    validateRating,
    validateVote
};