import { Router } from 'express';
import * as repoController from '../controllers/repos';
import { validateJWT } from '../middlewares/validateJWT';
import { validateLayerExistance } from '../middlewares/layer-middlewares';
import { validateProjectExistance, ownerOrCollaborator, validateUserAccessOnProject } from '../middlewares/project-middlewares';
import { addNewRepoCollaborators } from '../middlewares/collaborators-middlewares';
import { createRepoOnGitlab, createRepoOnMongoDB, validateCollaboratorAccessOnRepository, verifyLayerAccessLevelOfNewCollaborator, validateRepositoryExistance, 
    updateRepoCollaborators, newCollaborators, deleteCollaborators, getProjectReposDataBaseOnAccess, getLayerReposDataBaseOnAccess, verifyProjectLevelAccessOfNewCollaborator, verifyTwoAccessLevelOfCollaborator, verifyLayerRepos } from '../middlewares/repository-middlewares';

const router = Router();
// CRUD routes

router.post('/create-repository/:projectID/:layerID', [
    validateJWT,
    validateProjectExistance,
    validateLayerExistance,
    verifyTwoAccessLevelOfCollaborator(['administrator', 'manager']),
    verifyLayerRepos,
    createRepoOnGitlab,
    createRepoOnMongoDB,
    addNewRepoCollaborators ], repoController.createRepository);
    
router.post('/updateRepos', repoController.updateRepos);


router.get('/:id', [ ],  repoController.getRepositoryById);
router.get('/getAllRepos/:userId', repoController.getRepositoriesByUserId);
router.get('/get-repo-collaborators/:repoId', repoController.getRepoCollaborators);
router.get('/get-layer-repos/:projectID/:layerID', [validateJWT, validateProjectExistance, validateUserAccessOnProject, getLayerReposDataBaseOnAccess ], repoController.getReposByLayer )
router.get('/get-repos/:projectID',  [
    validateJWT,
    validateProjectExistance,
    validateUserAccessOnProject,
    getProjectReposDataBaseOnAccess ], repoController.getReposByProject );


router.put('/update-repository/:projectID/:layerID/:repoID',  [
    validateJWT,
    validateProjectExistance,
    validateLayerExistance,
    validateRepositoryExistance,
    validateCollaboratorAccessOnRepository(['administrator']),
    deleteCollaborators,
    updateRepoCollaborators,
    verifyProjectLevelAccessOfNewCollaborator,        
    verifyLayerAccessLevelOfNewCollaborator,
    newCollaborators ], repoController.updateRepository)


router.delete('/:id', repoController.deleteRepository);

export default router;
