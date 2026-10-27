import * as searchService from './search.service';

/**
 * Controller: Lấy danh sách gợi ý tìm kiếm (Search Suggestions)
 */
export const getSearchSuggestions = async (req, res, next) => {
  try {
    const q = req.query.q || req.query.keyword || '';
    const limit = req.query.limit;
    const result = await searchService.getSearchSuggestions({
      q,
      limit,
      actor: req.actor
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Unified Search tổng hợp
 */
export const unifiedSearch = async (req, res, next) => {
  try {
    const result = await searchService.unifiedSearch(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
