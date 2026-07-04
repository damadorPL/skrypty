#!/bin/bash
# Run this script without any param for a dry run
# Run the script with root and with exec param for removing old kernels after checking
# the list printed in the dry run

uname -a
IN_USE=$(uname -r)
echo "Your in use kernel is $IN_USE"

OLD_KERNELS=$(
    dpkg --list |
        grep -v "$IN_USE" |
        grep -E '^(ii|rc)\s+linux-(image|headers|modules|image-extra|modules-extra)-[0-9]' |
        awk '{ print $2 }'
)
echo "Old Kernels to be removed:"
echo "$OLD_KERNELS"

if [ "$1" == "exec" ]; then
    if [ -n "$OLD_KERNELS" ]; then
        echo "Purging old kernels..."
        sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y $OLD_KERNELS
    else
        echo "No old kernels to remove."
    fi
else
    echo "If all looks good, run it again like this: sudo remove_old_kernels.sh exec"
fi
