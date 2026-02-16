import express from 'express';
import { 
  createUserProject, 
  getUserCredits, 
  getUserProject, 
  getUserProjects, 
  purchaseCredits, 
  togglePublish 
} from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';

const userRouter = express.Router();

/**
 * All routes below require authentication
 */
userRouter.use(protect);

// Credit Management
userRouter.get('/credits', getUserCredits);
userRouter.post('/purchase-credits', purchaseCredits);

// Project Management
userRouter.route('/project')
  .get(getUserProjects)  // Simplified: /project usually returns the list
  .post(createUserProject);

userRouter.route('/project/:projectId')
  .get(getUserProject)
  .patch(togglePublish); // Changed to PATCH for a status toggle

export default userRouter;