export default function(context, error) {


    if (!context.store.state.authUser) { //MUST HAVE AN ACC
        error({
            message: 'You are not signed in',
            statusCode: 403
        });

    }
}