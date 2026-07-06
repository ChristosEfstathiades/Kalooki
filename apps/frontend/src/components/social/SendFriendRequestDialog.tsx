import { useState } from 'react'
import { extractApiErrors } from '#/lib/auth'
import { useSendFriendRequest } from '#/lib/social'
import FormErrors from '#/components/FormErrors'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

interface SendFriendRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog for sending a friend request by exact username. Typing never
 * suggests similar names (docs/features.md).
 */
export default function SendFriendRequestDialog({
  open,
  onOpenChange,
}: SendFriendRequestDialogProps) {
  const sendRequest = useSendFriendRequest()
  const [username, setUsername] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [sentTo, setSentTo] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrors([])
    setSentTo(null)
    try {
      const request = await sendRequest.mutateAsync(username.trim())
      setSentTo(request.recipient.username)
      setUsername('')
    } catch (error) {
      setErrors(extractApiErrors(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a friend request</DialogTitle>
          <DialogDescription>
            Enter the player&apos;s exact username — partial names won&apos;t
            match.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <FormErrors errors={errors} />
          {sentTo && (
            <p className="m-0 rounded-md border border-felt bg-felt/20 px-3 py-2 text-sm">
              Friend request sent to {sentTo}.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="friend-username">Username</Label>
            <Input
              id="friend-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={sendRequest.isPending || username.trim() === ''}
          >
            {sendRequest.isPending ? 'Sending…' : 'Submit request'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
