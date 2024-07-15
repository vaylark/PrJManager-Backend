import { NextFunction, Request, Response } from "express";
import Collaborator from "../../models/collaboratorSchema";
import Task from "../../models/taskSchema";
import Note from "../../models/noteSchema";
import { PopulatedTaskBase, PopulatedTask2_i, TaskBase, CompletedTaskBase, Repository_i, ApprovalTaskBase, 
        PPCompletedOrApprovalTaskBase, CompletedOrApprovalTaskBase, 
        PopulatedTask3, PPCompletedTaskBase, TaskWithReadyContributors, Collaborator_i, User_i, TasksData,
        C_On_Repository, C_On_Layer
    } from "../../interfaces/interfaces";


// ! Properties declared on the file express.d.ts

interface TasksMiddlwaresRequest {
    tasks?: TaskBase[];
    completedTasks: CompletedTaskBase[];
    approvalTasks: ApprovalTaskBase[];
    authorized?: User_i | Collaborator_i | boolean;
    completedTasksLength?: number;
    tasksData: TasksData;
}

type TaskQueryResult = Omit<TaskBase, 'repository_related_id'> & { repository_related_id: Repository_i };

type MatchConditions = {
    project?: string,
    status?: string,
    assigned_to?: string,
    updatedAt?: {
        $gte: Date,
        $lte: Date
    },
    completed_at?: {
        $gte: Date,
        $lte: Date
    } | { $ne: null },
};


const evalAccess = ( cOnLayer: C_On_Layer | null, cOnRepo: C_On_Repository | null, lVisibility: string, RVisibility: string ) => {

    if( cOnLayer && cOnRepo && cOnLayer.state && !cOnRepo.state && RVisibility === 'open' ) {
        return true;
    }

    if( cOnLayer && cOnRepo && !cOnLayer.state && lVisibility === 'open' && !cOnRepo.state && RVisibility === 'open' ) {
        return true;
    }

    return false;
};

const validateVisibility = (pVisisibility: string | undefined, lVisibility: string, rVisibility: string) => {
    if( pVisisibility === 'public' && lVisibility === 'open' && rVisibility === 'open' ) {
        return true;
    }
    return false;
};

const allTaskContributorsReady = (contributorsIds, readyContributors) => {
    if (contributorsIds.length !== readyContributors.length) {
      return false;
    }
  
    const sortedContributorsIds = contributorsIds.slice().sort().map(id => id.toString());
    const sortedReadyContributors = readyContributors.slice().sort((a, b) => a.uid.toString().localeCompare(b.uid.toString()));
  
    for (let i = 0; i < sortedContributorsIds.length; i++) {
      if (sortedContributorsIds[i] !== sortedReadyContributors[i].uid.toString()) {
        return false;
      }
    }
    return true;
};



export const getTaskContributors = async(req: Request, res: Response, next: NextFunction) => {
 
    const { taskId } = req.params;

    try {
        const task = await Task.findById(taskId)
                        .select('commits_hashes contributorsIds')
                        .populate({
                            path: 'contributorsIds',
                            select: 'username photoUrl _id'
                        })

        if (!task) {
            return res.status(404).json({
                message: 'Task not found'
            })
        }

        req.hashes = task.commits_hashes;
        req.contributorsData = task.contributorsIds
        next();
    
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: 'Internal Server error',
            error
        })
    }
};

export const getTaskData = async(req: Request, res: Response, next: NextFunction) => {
    const { taskId } = req.params;

    try {
        const task: PopulatedTaskBase = await Task.findById(taskId)
                            .populate({
                                path: 'layer_related_id',
                                select: 'name _id'
                            })
                            .populate({
                                path: 'repository_related_id',
                                select: 'name _id'
                            })
                            .populate({
                                path: 'project',
                                select: 'name _id'
                            })
                            .populate({
                                path: 'readyContributors.uid',
                                select: 'username photoUrl _id'
                            })
                            .populate({
                                path: 'reasons_for_rejection.uid',
                                select: 'username photoUrl _id'
                            }) as PopulatedTaskBase
        if (!task) {
            return res.status(404).json({
                message: 'Task not found'
            })
        }

        req.task = task;
        next();

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: 'Internal Server error',
            error
        })
    }
};

export const getProjectTasksBaseOnAccessForHeatMap = async(req: Request, res: Response, next: NextFunction) => {
    const { projectID } = req.params;
    const uid = req.query.uid
    const queryYear = req.query.year as string
    const year = parseInt(queryYear, 10); // Asegúrate de convertir el año a número
    const { levels = [], owner, type } = req
    
    if( owner && owner === true ) {
        return next();
    }

    let matchCondition: MatchConditions = { project: projectID, status: 'completed' };
    if (year) {
        matchCondition = { 
        ...matchCondition,
        updatedAt: {
            $gte: new Date(`${year}-01-01T00:00:00.000Z`),
            $lte: new Date(`${year}-12-31T23:59:59.999Z`)
        }
        };
    }

    try {
        if( type === 'collaborator') {
            const tasks: PopulatedTask2_i[] = await Task.find(matchCondition)
                                .populate('layer_related_id repository_related_id')
                                .lean()         
             // ! Tareas en el que el usuario tiene acceso como colaborador ( state : true )

            const filteredTasksBaseOnAccess: TaskBase[] = (await Promise.all(tasks.map(async (task: PopulatedTask2_i) => {
                const { layer_related_id: { _id: taskId }, repository_related_id: { _id: repoId }, ...rest } = task;
                const cLayer = await Collaborator.findOne({ uid, projectID, state: true, 'layer._id': taskId });
                const cRepo = await Collaborator.findOne({ uid, projectID, state: true, 'repository._id': repoId });
            
                if (cLayer && cRepo) {
                    return {
                        ...rest,
                        layer_related_id: taskId, 
                        repository_related_id: repoId,
                    } as TaskBase;
                }
            }))).filter((task): task is TaskBase => task !== undefined);


            // ! Tareas en el caso de que el usuario no tiene acceso como colaborador ( state: false ), pero los padres son abiertos
            const uniqueTasksOnOpenParents: TaskBase[]  = ( await Promise.all( tasks.filter( ( openTask: PopulatedTask2_i ) => 
                !filteredTasksBaseOnAccess.some(task => task._id.toString() === openTask._id.toString())
              ).map( async task => {  
                    const { layer_related_id: { _id: taskId, visibility: layerVis }, repository_related_id: { _id: repoId, visibility: repoVis }, ...rest } = task;

                    const cLayer: C_On_Layer | null = await Collaborator.findOne({ uid, projectID, 'layer._id': taskId });
                    const cRepo: C_On_Repository | null = await Collaborator.findOne({ uid, projectID, 'repository._id': repoId });

                    if(evalAccess(cLayer, cRepo, layerVis, repoVis)) {
                        return { 
                            ...rest,
                            layer_related_id: taskId, 
                            repository_related_id: repoId,
                         } as TaskBase;
                    };
              })
             )).filter((task): task is TaskBase => task !== undefined);
              
            req.tasks = [...filteredTasksBaseOnAccess, ...uniqueTasksOnOpenParents];
            next();

        } else {
            const tasks: PopulatedTask2_i[] = await Task.find(matchCondition)
                                .populate('layer_related_id repository_related_id')
                                .lean()

            // ! Tareas en el caso de que el usuario sea un guest
            const filteredTasksBaseOnLevel: TaskBase[] = tasks.reduce<TaskBase[]>((acc, task) => {
                const { layer_related_id, repository_related_id } = task;

                if (layer_related_id && repository_related_id && levels.includes(layer_related_id.visibility) && levels.includes(repository_related_id.visibility)) {
                    const taskWithIdsOnly = {
                        ...task, 
                        layer_related_id: layer_related_id._id, // Usa el _id del documento poblado.
                        repository_related_id: repository_related_id._id,
                    };
                    acc.push(taskWithIdsOnly);
                };
                return acc;
            }, []);

            req.tasks = filteredTasksBaseOnLevel;
            next();
        }
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: 'Internal Server error',
            error
        })
    }
};

export const getProjectTasksBaseOnAccess = async(req: Request, res: Response, next: NextFunction) => {
    const { projectID } = req.params;
    const { levels = [], owner, type } = req
    const uid = req.query.uid
    
    if( owner && owner === true ) {
        return next();
    }

    try {
                               
        if( type === 'collaborator') {

            const tasks: PPCompletedOrApprovalTaskBase[] = await Task.find({ project: projectID, status: { $in: ['completed', 'approval'] } })
            .populate('layer_related_id repository_related_id')
            .lean()


            // ! Tareas en el que el usuario tiene acceso como colaborador ( state : true )

            const filteredTasksBaseOnAccess: CompletedOrApprovalTaskBase[] = (await Promise.all(tasks.map(async (task: PPCompletedOrApprovalTaskBase) => {
                const { layer_related_id: { _id: taskId }, repository_related_id: { _id: repoId }, ...rest } = task;
                const cLayer = await Collaborator.findOne({ uid, projectID, state: true, 'layer._id': taskId });
                const cRepo = await Collaborator.findOne({ uid, projectID, state: true, 'repository._id': repoId });
            
                if (cLayer && cRepo) {
                    return {
                        ...rest,
                        layer_related_id: taskId, 
                        repository_related_id: repoId,
                    } as CompletedOrApprovalTaskBase;
                }
            }))).filter((task): task is CompletedOrApprovalTaskBase => task !== undefined); 


            // ! Tareas en el caso de que el usuario no tiene acceso como colaborador ( state: false ), pero los padres son abiertos

            const uniqueTasksOnOpenParents: CompletedOrApprovalTaskBase[] = ( await Promise.all( tasks.filter(( openTask: PPCompletedOrApprovalTaskBase ) => 
                !filteredTasksBaseOnAccess.some(task => task._id.toString() === openTask._id.toString())
              ).map( async task => {  
                    const { layer_related_id: { _id: layerId, visibility: layerVis }, repository_related_id: { _id: repoId, visibility: repoVis }, ...rest } = task;

                    const cLayer: C_On_Layer | null = await Collaborator.findOne({ uid, projectID, 'layer._id': layerId });
                    const cRepo : C_On_Repository | null = await Collaborator.findOne({ uid, projectID, 'repository._id': repoId });

                    if(evalAccess(cLayer, cRepo, layerVis, repoVis)) {
                        return { 
                            ...rest,
                            layer_related_id: layerId, 
                            repository_related_id: repoId,
                         } as CompletedOrApprovalTaskBase;
                    };
              })
             )).filter((task): task is CompletedOrApprovalTaskBase => task !== undefined);
              

            const filteredTasksBaseOnLevel = [...filteredTasksBaseOnAccess, ...uniqueTasksOnOpenParents];

            // Filtrar tareas completadas
            const completedTasks: CompletedTaskBase[] = filteredTasksBaseOnLevel.filter((task): task is CompletedTaskBase => task.status === 'completed');

            // Filtrar tareas en aprobación
            const approvalTasks: ApprovalTaskBase[] = filteredTasksBaseOnLevel.filter((task): task is ApprovalTaskBase => task.status === 'approval');


            req.completedTasks = completedTasks;
            req.approvalTasks = approvalTasks;
            next();

        } else {

            const tasks: PPCompletedTaskBase[] = await Task.find({ project: projectID, status: { $in: ['completed'] } })
            .populate('layer_related_id repository_related_id')
            .lean()

            // ! Tareas en el caso de que el usuario sea un guest

            const filteredTasksForGuests: CompletedTaskBase[] = tasks.reduce<CompletedTaskBase[]>((acc, task) => {
                const { layer_related_id, repository_related_id } = task;

                if (layer_related_id && repository_related_id && levels.includes(layer_related_id.visibility) && levels.includes(repository_related_id.visibility)) {
                    const taskWithIdsOnly = {
                        ...task, // Convierte el documento de Mongoose a un objeto JS plano.
                        layer_related_id: layer_related_id._id, // Usa el _id del documento poblado.
                        repository_related_id: repository_related_id._id, // Ídem.
                    };
                    acc.push(taskWithIdsOnly);
                };
                return acc;
            }, []);

            req.completedTasks = filteredTasksForGuests;
            req.approvalTasks = [];
            next();
        }
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: 'Internal Server error',
            error
        })
    }
};

export const validateCollaboratorAccess = ( minAccess: string[] ) => {
    return async( req: Request, res: Response, next: NextFunction ) => {

        const { project, owner } = req;
        const { projectID } = req.params;
        const { uid, layerID, repoID, } = req.query

        try {
            if( owner && project?.owner.toString() === uid ) {
                req.authorized = owner;
                req.type = 'authorized';
                return next();
            }

            const collaboratorOnProject = await Collaborator.findOne({ uid, projectID, state: true, 'project._id': projectID })
            if (!collaboratorOnProject) {
                return res.status(401).json({
                    success: false,
                    message: 'You do not have access to this resource'
                })
            };


            if( minAccess.includes( collaboratorOnProject?.project?.accessLevel ?? 'no-access' ) ) {
                req.authorized = collaboratorOnProject;
                req.type = 'authorized';
                return next();
            };


            const collaboratorOnLayer = await Collaborator.findOne({ uid, projectID, state: true, 'layer._id': layerID })
            if ( collaboratorOnLayer && minAccess.includes( collaboratorOnLayer?.layer?.accessLevel ?? 'no-access' ) ) {
                req.authorized = collaboratorOnLayer;
                req.type = 'authorized';
                return next();
            };


            const collaboratorOnRepo = await Collaborator.findOne({ uid, projectID, state: true, 'repository._id': repoID })
            if ( collaboratorOnRepo && minAccess.includes( collaboratorOnRepo?.repository?.accessLevel ?? 'no-access' ) ) {
                req.authorized = collaboratorOnRepo;
                req.type = 'authorized';
                return next();
            };

            req.type = 'no-authorized'

            return res.status(401).json({
                success: false,
                message: 'You do not have access to this resource'
            })
         
        } catch (error) {
            console.log(error)
            return res.status(500).json({
                success: false,
                message: 'Internal Server error',
                error
            })
        }
    }
};

export const getCompletedTasksLength = async(req: Request, res: Response, next: NextFunction) => {
    const { uid } = req.params;
    const { currentYear, currentMonth } = req.query;
    
    // Convertir a números si no lo son, ya que los parámetros de la consulta son recibidos como strings
    const year = Number(currentYear);
    const month = Number(currentMonth);

    if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({
            message: "Invalid year or month"
        });
    }

    // Ajuste para el índice de mes correcto (-1 si los meses vienen de 1 a 12)
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    if (isNaN(startDate.valueOf()) || isNaN(endDate.valueOf())) {
        return res.status(400).json({
            message: "Generated dates are invalid."
        });
    }


    let assignedfilter = { 
        assigned_to: uid, 
        status: 'completed', 
        updatedAt: {
            $gte: startDate,
            $lte: endDate
        }
     };

    let contributionsFilter = { 
        contributorsIds: uid, 
        status: 'completed',
        updatedAt: {
            $gte: startDate,
            $lte: endDate
        }
     };

    try {

        const tasks = await Task.find(assignedfilter)
        .sort({ updatedAt: -1 })
        .select('_id task_name')

        const contributions = await Task.find(contributionsFilter)
            .sort({ updatedAt: -1 })
            .select('_id task_name')


        const combinedTasks = [...tasks, ...contributions];

        const uniqueTasks = combinedTasks.filter(
            (task, index, self) => self.findIndex(t => t._id.toString() === task._id.toString()) === index
        );

        req.completedTasksLength = uniqueTasks.length;

        next();

    } catch (error) {

        console.log(error)
        return res.status(500).json({
            message: 'Internal Server error',
            error
        })
    }
}; 

export const updateParticipation = async (req: Request, res: Response, next: NextFunction) => {
const { taskId } = req.params;
const { uid, notes } = req.body; // Asegúrate de que uid sea un string.

try {
    const task = await Task.findById(taskId);

    if (!task) {
    return res.status(404).json({ message: 'Task not found' });
    }

    if (task.type === "assigned") {
        const isContributor = task.contributorsIds.includes(uid);
        const itIsTheAssigned = task.assigned_to.toString() === uid;

        if (isContributor || itIsTheAssigned) {
            if(itIsTheAssigned){
                await Task.updateOne(
                    { _id: taskId },
                    { $set: { readyContributors: task.contributorsIds.map(id => ({ uid: id, date: new Date(), me: false })) } }
                );
            } else {
                await Task.updateOne(
                    { _id: taskId },
                    { $set: { readyContributors: { uid, date: new Date(), me: true } } }
                );
            }

            // Convertir cada string de notes en un objeto que cumpla con noteSchema
            const formattedNotes = notes.map(noteText => ({ text: noteText, uid, task: taskId }));

            if (formattedNotes.length > 0) {
                await Note.insertMany(formattedNotes);
            }

            if (itIsTheAssigned) {
                return next();
            }
            return res.status(200).json({ message: 'Contributor marked as ready' });
        } else {
            return res.status(400).json({ message: 'User is not a contributor' });
        }
    } else {
        const isContributor = task.contributorsIds.includes(uid);

        if (isContributor) {
            const updatedTask = await Task.findOneAndUpdate(
            { _id: taskId },
            { $addToSet: { readyContributors: { uid, date: new Date(), me: true } } },
            { new: true }  // Asegura que el documento retornado sea el actualizado      
            );

            // Convertir cada string de notes en un objeto que cumpla con noteSchema
            const formattedNotes = notes.map(noteText => ({ text: noteText, uid, task: taskId }));

            if (formattedNotes.length > 0) {
            await Note.insertMany(formattedNotes);
            }

            if (updatedTask) {
            const isReady = allTaskContributorsReady(updatedTask.contributorsIds, updatedTask.readyContributors);
            if (isReady) {
                console.log('Task is ready');
                return next();
            }
            }
            console.log('Task is not ready');
            return res.status(200).json({ message: 'Contributor marked as ready' });
        } else {
            return res.status(400).json({ message: 'User is not a contributor' });
        }
    }
} catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'An error occurred', error });
}
};

export const getTasksDates = async(req: Request, res: Response, next: NextFunction) => {
    const { uid } = req.params;
    const endDate = req.query.endDate as string;
    const startDate = req.query.startDate as string;
  
    try {


    // ! ASSIGNED

    // ? Creacion de tarea
    const taskSet0: TaskQueryResult[] = await Task.find({
    creator: uid,
    createdAt: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('createdAt task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    }) 



    // ? Envio a revision de tarea asignada
    const tasksSet1: TaskQueryResult[] = await Task.find({
    assigned_to: uid,
    // completed_at: null,
    reviewSubmissionDate: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('reviewSubmissionDate task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })

  

    // ? Tarea asignada y aprobada
    const tasksSet2: TaskQueryResult[] = await Task.find({
    assigned_to: uid,
    status: 'completed',
    completed_at: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('completed_at task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })

  
    // ! CONTRIBUTOR

    // ? Tarea enviada a revision en la que se es contribuidor
    const tasksSet3: TaskQueryResult[] = await Task.find({
    assigned_to: { $ne: uid },
    contributorsIds: uid,
    // completed_at: null,
    reviewSubmissionDate: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('reviewSubmissionDate task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })


    // ? Tarea aprobada en la que se es contribuidor
    const tasksSet4: TaskQueryResult[] = await Task.find({
    assigned_to: { $ne: uid },
    contributorsIds: uid,
    status: 'completed',
    completed_at: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('completed_at task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })

    // ? Tarea en la que se es contribuidor y terminaste tus contribuiciones
    const tasksSet5: TaskQueryResult[] = await Task.find({
        assigned_to: { $ne: uid },
        // me: true,
        contributorsIds: uid,
        readyContributors: { $elemMatch: { uid, me: true, date: { $gte: startDate, $lte: endDate } } }
    })
    .sort({ updatedAt: -1 })
    .select('completed_at task_name assigned_to _id repository_related_id readyContributors')
    .populate({
    path: 'repository_related_id',
    select: 'name'
    })
    .lean()
      
      const filteredTasksSet5: TaskWithReadyContributors[] = tasksSet5.map(task => {
        const { readyContributors, ...rest } = task;
        const matchedContributor = readyContributors.find(contributor => 
          contributor.uid.toString() === uid &&
          new Date(contributor.date) >= new Date(startDate) &&
          new Date(contributor.date) <= new Date(endDate)
        );
      
        return {
          ...rest,
          readyContributorData: matchedContributor ? matchedContributor : {}
        };
      });
  
      // Puedes adjuntar los conjuntos de tareas a la solicitud para usarlos más adelante si es necesario
      req.tasksData = { taskSet0, tasksSet1, tasksSet2, tasksSet3, tasksSet4, tasksSet5: filteredTasksSet5 };
  
      next();
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: 'Internal Server error',
        error,
      });
    }
};
  
export const getProjectTasksDates = async(req: Request, res: Response, next: NextFunction) => {
    const { projectId } = req.params;
    const { startDate, endDate, uid } = req.query
  
    try {


    // ? Creacion de tarea
    const taskSet0: TaskQueryResult[] = await Task.find({
        project: projectId,
        creator: uid,
        createdAt: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('createdAt task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })



    // ? Envio a revision de tarea asignada
    const tasksSet1: TaskQueryResult[] = await Task.find({
    project: projectId,
    assigned_to: uid,
    status: 'approval',
    completed_at: null,
    reviewSubmissionDate: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('reviewSubmissionDate task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })

  

    // ? Tarea asignada y aprobada
    const tasksSet2: TaskQueryResult[] = await Task.find({
    project: projectId,
    assigned_to: uid,
    status: 'completed',
    completed_at: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('completed_at task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })

  

    // ? Tarea enviada a revision en la que se es contribuidor
    const tasksSet3: TaskQueryResult[] = await Task.find({
    project: projectId,
    assigned_to: { $ne: uid },
    contributorsIds: uid,
    status: 'approval',
    completed_at: null,
    reviewSubmissionDate: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('reviewSubmissionDate task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })


    // ? Tarea aprobada en la que se es contribuidor
    const tasksSet4: TaskQueryResult[] = await Task.find({
    project: projectId,
    assigned_to: { $ne: uid },
    contributorsIds: uid,
    status: 'completed',
    completed_at: { $gte: startDate, $lte: endDate },
    })
    .sort({ updatedAt: -1 })
    .select('completed_at task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })

    // ? Tarea aprobada en la que se es contribuidor y se marco como lista
    const tasksSet5: TaskQueryResult[] = await Task.find({
    project: projectId,
    assigned_to: { $ne: uid },
    contributorsIds: uid,
    status: 'completed',
    readyContributors: { $elemMatch: { uid, date: { $gte: startDate, $lte: endDate } } },
    })
    .sort({ updatedAt: -1 })
    .select('completed_at task_name assigned_to _id repository_related_id')
    .populate({
        path: 'repository_related_id',
        select: 'name'
    })

  
      // Puedes adjuntar los conjuntos de tareas a la solicitud para usarlos más adelante si es necesario
      req.tasksData = { taskSet0, tasksSet1, tasksSet2, tasksSet3, tasksSet4, tasksSet5 };
  
      next();
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: 'Internal Server error',
        error,
      });
    }
};

export const getProfileTasksFiltered = async( req: Request, res: Response, next: NextFunction ) => {

    const { uid } = req.params;
    const { year } = req.query;

    let matchCondition: any = {
        assigned_to: uid,
        status: 'completed',
        completed_at: { $ne: null }  // Asegura que completed_at no sea null
    };
    
    if (year) {
        matchCondition = {
            ...matchCondition,
            $and: [  // Combina condiciones para mantener ambas restricciones
                { completed_at: { $gte: new Date(`${year}-01-01T00:00:00.000Z`) } },
                { completed_at: { $lte: new Date(`${year}-12-31T23:59:59.999Z`) } }
            ]
        };
    }


    try {
        const tasks: PopulatedTask3[] = await Task.find( matchCondition )
        .sort({ updatedAt: -1 })
        .select('completed_at task_name assigned_to _id project layer_related_id repository_related_id')
        .populate('repository_related_id', 'visibility name')
        .populate('layer_related_id', 'visibility name')
        .populate('project', 'visibility name')


        const filteredTasks: PopulatedTask3[] = tasks.reduce<PopulatedTask3[]>((acc, task) => {
            const { project, layer_related_id, repository_related_id } = task;

            if (validateVisibility(project?.visibility, layer_related_id?.visibility, repository_related_id?.visibility)) {
                acc.push(task);
            }
            return acc;
        }, []);

        req.tasks = filteredTasks;
        next();
        
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Internal Server error',
            error
        });
    }
};
